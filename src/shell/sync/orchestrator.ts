import type { ActiveFileSnapshot } from '../../core/active-file'
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
import { snapshotLocal } from './first-connect'
import { setSyncState, getSyncState } from './state'
import { clearDirty, getDirtySince, setSuspended } from './dirty'
import { getActiveBackend } from './backends/registry'
import { ConcurrencyConflictError, NeedsAuthError } from './backend'
import { DriveError } from '../drive'

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

export interface RunSyncOptions {
  // When true, fall back to interactive OAuth if silent refresh fails.
  // Caller MUST invoke from a user-gesture handler — browsers block popups
  // otherwise. Default false: silent-only, for navigation-triggered syncs.
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
  const backend = getActiveBackend()

  if (!backend.isConfigured()) {
    setSyncState({ status: 'offline' })
    return { kind: 'no-folder' }
  }

  setSyncState({ status: 'syncing', errorMessage: '' })
  const dirtyAtStart = getDirtySince()

  // Retry loop for optimistic concurrency: if the backend reports a
  // concurrent modification (Drive 412 or Firebase transaction abort),
  // re-inspect, re-merge, and retry up to MAX_RETRIES times.
  const MAX_RETRIES = 3

  try {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const inspection = await backend.inspect(
        options.allowInteractive === true ? { allowInteractive: true } : {},
      )
      const localSnapshot = await snapshotLocal()

      let merged: ActiveFileSnapshot
      let conflicts: readonly AggregatedConflict[] = []
      let concurrencyToken: string | null = null

      if (inspection.kind === 'empty') {
        merged = localSnapshot
      } else if (inspection.kind === 'exists') {
        const result = mergeSnapshots(localSnapshot, inspection.file)
        merged = result.merged
        conflicts = result.conflicts
        concurrencyToken = inspection.concurrencyToken
      } else {
        setSyncState({
          status: 'error',
          errorMessage: `Remote data is unreadable: ${inspection.error}`,
        })
        return { kind: 'error', message: inspection.error }
      }

      const now = Date.now()
      merged = bumpConflictWinners(merged, conflicts, now)

      setSuspended(true)
      try {
        await applySnapshotToLocal(merged)
      } finally {
        setSuspended(false)
      }

      for (const c of conflicts) {
        await persistConflict(c, now)
      }

      // Auto-prune conflict records that no longer appear in the current merge.
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
        await backend.write(merged, concurrencyToken)

        const editedMidSync = getDirtySince() > dirtyAtStart
        if (!editedMidSync) {
          clearDirty()
        }

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
        const isRetriable =
          (pushErr instanceof DriveError && pushErr.status === 412) ||
          pushErr instanceof ConcurrencyConflictError
        if (isRetriable && attempt < MAX_RETRIES - 1) {
          continue
        }
        throw pushErr
      }
    }
    throw new Error('unreachable: sync retry loop exhausted without result')
  } catch (err) {
    if (err instanceof NeedsAuthError) {
      setSyncState({ status: 'error', errorMessage: err.message })
      return { kind: 'needs-auth' }
    }
    const message =
      err instanceof DriveError && err.status === 412
        ? 'Sync conflict with another device — tap "Sync now" to retry'
        : err instanceof ConcurrencyConflictError
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

export function getLastSyncedAt(): number {
  return getSyncState().lastSyncedAt
}
