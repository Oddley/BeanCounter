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
  bumpConflictWinners,
  type AggregatedConflict,
} from '../../core/sync'
import {
  db,
  SETTINGS_SINGLETON_ID,
  persistConflict,
  conflictRecordId,
} from '../db'
import {
  inspectDrive,
  snapshotLocal,
} from './first-connect'
import { setSyncState, getSyncState } from './state'
import { clearDirty, getDirtySince, setSuspended } from './dirty'
import {
  isSidecarAvailable,
  pushConnectionToSidecar,
  sidecarInspect,
  sidecarWrite,
} from './sidecar'

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
  etag: string | null,
): Promise<string> {
  const json = snapshotToJson(snapshot)
  return await writeFile(token, {
    name: ACTIVE_FILE_NAME,
    parentId: folderId,
    content: json,
    ...(existingFileId !== undefined ? { existingFileId } : {}),
    // If-Match turns the write into a conditional update. Drive returns 412
    // if another device modified the file since we read it, which the caller
    // catches and retries. Omitted when etag is null (degraded path) or when
    // creating a new file (existingFileId is undefined).
    ...(etag !== null && existingFileId !== undefined ? { ifMatch: etag } : {}),
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

  // Check for the Android sidecar service on localhost:7734. When it's
  // present, all Drive I/O goes through it — no browser OAuth popup needed,
  // since the sidecar holds persistent credentials via play-services-auth.
  const useSidecar = await isSidecarAvailable()
  if (useSidecar) {
    // Keep the sidecar informed of the current folder/file so it can
    // resolve paths without the PWA re-sending them every request.
    await pushConnectionToSidecar()
  }

  let token: string | null = null
  if (!useSidecar) {
    token = await getValidToken()
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
  }

  // Retry loop for optimistic concurrency: if Drive returns 412 (another
  // device pushed between our read and write), re-inspect, re-merge, and
  // retry up to MAX_RETRIES times. On the final attempt a 412 is re-thrown
  // to the outer catch like any other error.
  const MAX_RETRIES = 3
  const knownFileId = getStoredFileId() ?? undefined

  try {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const inspection = useSidecar
        ? await sidecarInspect(folderId, knownFileId)
        : await inspectDrive(token!, folderId, knownFileId)
      const localSnapshot = await snapshotLocal()

      let merged: ActiveFileSnapshot
      let conflicts: readonly AggregatedConflict[] = []
      let existingFileId: string | undefined
      let etag: string | null = null

      if (inspection.kind === 'empty') {
        merged = localSnapshot
      } else if (inspection.kind === 'exists') {
        const result = mergeSnapshots(localSnapshot, inspection.file)
        merged = result.merged
        conflicts = result.conflicts
        existingFileId = inspection.fileId
        etag = inspection.etag
      } else {
        // unreadable — not worth retrying
        setSyncState({
          status: 'error',
          errorMessage: `Drive's active.json is unreadable: ${inspection.error}`,
        })
        return { kind: 'error', message: inspection.error }
      }

      // If we detected conflicts, bump each conflict-winner's recency
      // timestamp to `now` before applying-to-local + pushing. Without
      // this, both devices keep re-detecting the same tie on every
      // sync and flip-flop the winner forever ("thrash"). See
      // bump-conflict-winners.ts for the design rationale.
      const now = Date.now()
      merged = bumpConflictWinners(merged, conflicts, now)

      // Suspend dirty marking while we apply remote state to local, otherwise
      // our own writes would mark the app dirty in a loop.
      setSuspended(true)
      try {
        await applySnapshotToLocal(merged)
      } finally {
        setSuspended(false)
      }

      // Persist each currently-detected conflict locally so the user
      // can review/flip via /conflicts. Idempotent — re-detection
      // upserts on composite id. Runs OUTSIDE the suspendDirty window
      // because we want the conflict-table writes to be visible
      // immediately, and they don't count as user edits (no markDirty
      // inside persistConflict).
      for (const c of conflicts) {
        await persistConflict(c, now)
      }

      // Auto-prune stale conflict records: a conflict record represents
      // "this entity is currently in tension between local and remote."
      // If a subsequent merge no longer detects that tension (because
      // someone resolved it, a peer's edit broke the tie, or a schema-
      // evolution bug got fixed), the stored record is stale and should
      // disappear so the indicator clears without manual cleanup.
      //
      // This is the recovery path for the schema-evolution incident:
      // any spurious conflicts that piled up before the parser-normalize
      // fix evaporate on the next successful sync.
      const currentIds = new Set(
        conflicts.map((c) => conflictRecordId(c.entityType, c.id)),
      )
      const allStored = await db.conflicts.toArray()
      const staleIds = allStored
        .filter((r) => !currentIds.has(r.id))
        .map((r) => r.id)
      if (staleIds.length > 0) {
        await db.conflicts.bulkDelete(staleIds)
      }

      try {
        const pushedFileId = useSidecar
          ? await sidecarWrite({
              folderId,
              content: snapshotToJson(merged),
              ...(existingFileId !== undefined ? { existingFileId } : {}),
              fileName: ACTIVE_FILE_NAME,
              ...(etag !== null ? { ifMatch: etag } : {}),
            })
          : await pushSnapshot(token!, folderId, merged, existingFileId, etag)
        // Cache the file id so subsequent syncs use the fast direct-fetch
        // path in inspectDrive (avoids the folder-search query, which fails
        // for users whose drive.file scope only covers the file — e.g.,
        // invite recipients).
        setStoredFileId(pushedFileId)

        // If a new edit landed during the sync, getDirtySince() moved
        // forward. Preserve that signal — don't clearDirty, and label the
        // resulting state 'dirty' so the next navigation re-syncs.
        const editedMidSync = getDirtySince() > dirtyAtStart
        if (!editedMidSync) {
          clearDirty()
        }

        // Count unresolved conflicts ACROSS the whole conflicts table
        // (not just the ones from this sync — earlier syncs may have left
        // unresolved records the user hasn't flipped yet).
        const unresolvedCount = await db.conflicts.count()

        if (unresolvedCount > 0) {
          setSyncState({
            status: 'conflicts',
            errorMessage: `${String(unresolvedCount)} unresolved sync conflict${unresolvedCount === 1 ? '' : 's'}`,
            lastSyncedAt: now,
            conflictCount: unresolvedCount,
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
      } catch (pushErr) {
        if (
          pushErr instanceof DriveError &&
          pushErr.status === 412 &&
          attempt < MAX_RETRIES - 1
        ) {
          // Another device pushed between our read and write. Loop back to
          // re-inspect Drive with the current remote state, re-merge, and
          // retry the push with the fresh etag.
          continue
        }
        // Not a retriable 412, or we've exhausted all attempts — bubble up.
        throw pushErr
      }
    }
    // Unreachable: the final loop iteration always returns (success) or
    // throws (pushErr re-thrown above). TypeScript requires a return here.
    throw new Error('unreachable: sync retry loop exhausted without result')
  } catch (err) {
    const message =
      err instanceof DriveError && err.status === 412
        ? 'Sync conflict with another device — tap "Sync now" to retry'
        : err instanceof DriveError
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
