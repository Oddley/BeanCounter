import {
  getStoredFolderId,
  getStoredFileId,
  getValidToken,
  requestToken,
  setStoredFileId,
} from '../auth'
import { DriveError, writeFile } from '../drive'
import {
  type ActiveFileSnapshot,
  snapshotToJson,
} from '../../core/active-file'
import {
  mergeSnapshots,
  type AggregatedConflict,
} from '../../core/sync'
import { db, SETTINGS_SINGLETON_ID } from '../db'
import {
  inspectDrive,
  snapshotLocal,
} from './first-connect'
import { setSyncState, getSyncState } from './state'
import { clearDirty, getDirtySince, setSuspended } from './dirty'

const ACTIVE_FILE_NAME = 'active.json'

export type SyncRunResult =
  | { kind: 'success'; conflicts: readonly AggregatedConflict[] }
  | { kind: 'needs-auth' }
  | { kind: 'no-folder' }
  | { kind: 'error'; message: string }

let runInProgress: Promise<SyncRunResult> | null = null

// Apply a merged snapshot to local Dexie. Wipes + bulk-adds because the
// merged snapshot is the complete state. Wrapped in suspendDirty so the
// resulting Dexie writes don't loop back and mark the app dirty.
async function applySnapshotToLocal(
  snapshot: ActiveFileSnapshot,
): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.litters,
      db.kittens,
      db.settings,
      db.feedingSessions,
      db.weightEntries,
    ],
    async () => {
      await db.litters.clear()
      await db.kittens.clear()
      await db.feedingSessions.clear()
      await db.weightEntries.clear()
      if (snapshot.litters.length > 0) {
        await db.litters.bulkAdd([...snapshot.litters])
      }
      if (snapshot.kittens.length > 0) {
        await db.kittens.bulkAdd([...snapshot.kittens])
      }
      if (snapshot.feedingSessions.length > 0) {
        await db.feedingSessions.bulkAdd([...snapshot.feedingSessions])
      }
      if (snapshot.weightEntries.length > 0) {
        await db.weightEntries.bulkAdd([...snapshot.weightEntries])
      }
      await db.settings.put({
        ...snapshot.settings,
        id: SETTINGS_SINGLETON_ID,
      })
    },
  )
}

async function pushSnapshot(
  token: string,
  folderId: string,
  snapshot: ActiveFileSnapshot,
  existingFileId: string | undefined,
): Promise<string> {
  const json = snapshotToJson(snapshot)
  return await writeFile(token, {
    name: ACTIVE_FILE_NAME,
    parentId: folderId,
    content: json,
    ...(existingFileId !== undefined ? { existingFileId } : {}),
  })
}

export interface RunSyncOptions {
  // When true, fall back to interactive OAuth (consent popup) if silent
  // refresh fails. Caller MUST invoke this from a user-gesture handler
  // (button onClick, etc.) — browsers block popups otherwise.
  // Default false: silent-only, suitable for navigation-triggered and
  // boot-triggered syncs that mustn't surprise the user with a popup.
  readonly allowInteractive?: boolean
}

export async function runSync(
  options: RunSyncOptions = {},
): Promise<SyncRunResult> {
  if (runInProgress !== null) return runInProgress
  runInProgress = doRunSync(options).finally(() => {
    runInProgress = null
  })
  return runInProgress
}

async function doRunSync(
  options: RunSyncOptions,
): Promise<SyncRunResult> {
  const folderId = getStoredFolderId()
  if (folderId === null) {
    setSyncState({ status: 'offline' })
    return { kind: 'no-folder' }
  }

  setSyncState({ status: 'syncing', errorMessage: '' })

  // Snapshot the dirty timestamp at the start of the run. If the user
  // edits *during* the sync, getDirtySince() will move forward, and we
  // detect that at the end to stay in 'dirty' rather than 'synced'.
  const dirtyAtStart = getDirtySince()

  let token = await getValidToken()
  if (token === null && options.allowInteractive === true) {
    try {
      const fresh = await requestToken()
      token = fresh.accessToken
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Re-auth failed'
      setSyncState({
        status: 'error',
        errorMessage: `Sign-in cancelled or blocked: ${message}`,
      })
      return { kind: 'needs-auth' }
    }
  }
  if (token === null) {
    setSyncState({
      status: 'error',
      errorMessage:
        'Drive session expired — open Settings and tap "Sync now" to refresh',
    })
    return { kind: 'needs-auth' }
  }

  try {
    const knownFileId = getStoredFileId() ?? undefined
    const inspection = await inspectDrive(token, folderId, knownFileId)
    const localSnapshot = await snapshotLocal()

    let merged: ActiveFileSnapshot
    let conflicts: readonly AggregatedConflict[] = []
    let existingFileId: string | undefined

    if (inspection.kind === 'empty') {
      merged = localSnapshot
      existingFileId = undefined
    } else if (inspection.kind === 'exists') {
      const result = mergeSnapshots(localSnapshot, inspection.file)
      merged = result.merged
      conflicts = result.conflicts
      existingFileId = inspection.fileId
    } else {
      // unreadable
      setSyncState({
        status: 'error',
        errorMessage: `Drive's active.json is unreadable: ${inspection.error}`,
      })
      return { kind: 'error', message: inspection.error }
    }

    // Suspend dirty marking while we apply remote state to local, otherwise
    // our own writes would mark the app dirty in a loop.
    setSuspended(true)
    try {
      await applySnapshotToLocal(merged)
    } finally {
      setSuspended(false)
    }

    const pushedFileId = await pushSnapshot(
      token,
      folderId,
      merged,
      existingFileId,
    )
    // Cache the file id so subsequent syncs use the fast direct-fetch
    // path in inspectDrive (avoids the folder-search query, which fails
    // for users whose drive.file scope only covers the file — e.g.,
    // invite recipients).
    setStoredFileId(pushedFileId)

    const now = Date.now()
    // If a new edit landed during the sync, getDirtySince() moved
    // forward. Preserve that signal — don't clearDirty, and label the
    // resulting state 'dirty' so the next navigation re-syncs.
    const editedMidSync = getDirtySince() > dirtyAtStart
    if (!editedMidSync) {
      clearDirty()
    }

    if (conflicts.length > 0) {
      setSyncState({
        status: 'error',
        errorMessage: `${String(conflicts.length)} merge conflict${conflicts.length === 1 ? '' : 's'}`,
        lastSyncedAt: now,
        conflictCount: conflicts.length,
      })
    } else if (editedMidSync) {
      setSyncState({
        status: 'dirty',
        errorMessage: '',
        lastSyncedAt: now,
        conflictCount: 0,
      })
    } else {
      setSyncState({
        status: 'synced',
        errorMessage: '',
        lastSyncedAt: now,
        conflictCount: 0,
      })
    }
    return { kind: 'success', conflicts }
  } catch (err) {
    const message =
      err instanceof DriveError
        ? `Drive API error (${String(err.status)}): ${err.message}`
        : err instanceof Error
          ? err.message
          : 'Sync failed'
    setSyncState({ status: 'error', errorMessage: message })
    return { kind: 'error', message }
  }
}

// Last successful sync timestamp (ms epoch). Used by Settings UI to
// show "Last synced: 3m ago" — no longer drives any sync decisions.
export function getLastSyncedAt(): number {
  return getSyncState().lastSyncedAt
}
