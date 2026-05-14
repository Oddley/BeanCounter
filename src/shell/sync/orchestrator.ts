import { getStoredFolderId, getValidToken } from '../auth'
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
import { clearDirty, setSuspended, setOnDebounce } from './dirty'

const ACTIVE_FILE_NAME = 'active.json'

export type SyncRunResult =
  | { kind: 'success'; conflicts: readonly AggregatedConflict[] }
  | { kind: 'needs-auth' }
  | { kind: 'no-folder' }
  | { kind: 'error'; message: string }

let runInProgress: Promise<SyncRunResult> | null = null

// Apply a merged snapshot to local Dexie. Wipes + bulk-adds because the
// merged snapshot is the complete state. Wrapped in suspendDirty so the
// resulting Dexie writes don't loop back into the dirty timer.
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

export async function runSync(): Promise<SyncRunResult> {
  if (runInProgress !== null) return runInProgress
  runInProgress = doRunSync().finally(() => {
    runInProgress = null
  })
  return runInProgress
}

async function doRunSync(): Promise<SyncRunResult> {
  const folderId = getStoredFolderId()
  if (folderId === null) {
    setSyncState({ status: 'unconnected' })
    return { kind: 'no-folder' }
  }

  setSyncState({ status: 'pending', errorMessage: '' })

  const token = await getValidToken()
  if (token === null) {
    setSyncState({
      status: 'error',
      errorMessage: 'Drive session expired — tap to reconnect',
    })
    return { kind: 'needs-auth' }
  }

  try {
    const inspection = await inspectDrive(token, folderId)
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

    await pushSnapshot(token, folderId, merged, existingFileId)

    const now = Date.now()
    clearDirty()

    if (conflicts.length > 0) {
      setSyncState({
        status: 'error',
        errorMessage: `${String(conflicts.length)} merge conflict${conflicts.length === 1 ? '' : 's'}`,
        lastSyncedAt: now,
        conflictCount: conflicts.length,
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

// Track when the last sync attempt succeeded. Foreground-pull trigger
// uses this to decide whether to re-pull on app foreground return.
export function getLastSyncedAt(): number {
  return getSyncState().lastSyncedAt
}

// Wire the debounce timer in dirty.ts to the runner here. Fires once on
// module import (which happens via shell/sync/index.ts -> App.tsx chain).
setOnDebounce(() => {
  void runSync()
})
