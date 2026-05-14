import { type AppSettings } from '../settings'
import { type ActiveFileSnapshot, type ActiveFile } from '../active-file'
import { deepEqual } from './deep-equal'
import {
  type AggregatedConflict,
  type MergeConflict,
  type MergeResult,
  type SettingsMergeResult,
  type SnapshotMergeResult,
  type SyncableEntity,
} from './types'

export function mergeEntities<T extends SyncableEntity>(
  local: readonly T[],
  remote: readonly T[],
  equals: (a: T, b: T) => boolean = deepEqual as (a: T, b: T) => boolean,
): MergeResult<T> {
  const localById = new Map<string, T>()
  for (const item of local) {
    localById.set(item.id, item)
  }
  const remoteById = new Map<string, T>()
  for (const item of remote) {
    remoteById.set(item.id, item)
  }

  const merged: T[] = []
  const conflicts: MergeConflict<T>[] = []
  const seen = new Set<string>()

  for (const localItem of local) {
    seen.add(localItem.id)
    const remoteItem = remoteById.get(localItem.id)
    if (remoteItem === undefined) {
      merged.push(localItem)
      continue
    }
    if (localItem.lastUpdatedAt > remoteItem.lastUpdatedAt) {
      merged.push(localItem)
    } else if (remoteItem.lastUpdatedAt > localItem.lastUpdatedAt) {
      merged.push(remoteItem)
    } else {
      // Tie. Either identical (no conflict) or different (conflict).
      merged.push(localItem)
      if (!equals(localItem, remoteItem)) {
        conflicts.push({
          id: localItem.id,
          local: localItem,
          remote: remoteItem,
        })
      }
    }
  }

  for (const remoteItem of remote) {
    if (!seen.has(remoteItem.id)) {
      merged.push(remoteItem)
    }
  }

  return { merged, conflicts }
}

export function mergeSettings(
  local: AppSettings,
  remote: AppSettings,
): SettingsMergeResult {
  if (local.lastUpdatedAt > remote.lastUpdatedAt) {
    return { merged: local, conflict: null }
  }
  if (remote.lastUpdatedAt > local.lastUpdatedAt) {
    return { merged: remote, conflict: null }
  }
  // Tie.
  if (deepEqual(local, remote)) {
    return { merged: local, conflict: null }
  }
  return {
    merged: local,
    conflict: { id: 'settings', local, remote },
  }
}

export function mergeSnapshots(
  local: ActiveFileSnapshot,
  remote: ActiveFile,
): SnapshotMergeResult {
  const conflicts: AggregatedConflict[] = []

  const settingsResult = mergeSettings(local.settings, remote.settings)
  if (settingsResult.conflict !== null) {
    conflicts.push({
      entityType: 'settings',
      id: settingsResult.conflict.id,
      local: settingsResult.conflict.local,
      remote: settingsResult.conflict.remote,
    })
  }

  const littersResult = mergeEntities(local.litters, remote.litters)
  for (const c of littersResult.conflicts) {
    conflicts.push({
      entityType: 'litters',
      id: c.id,
      local: c.local,
      remote: c.remote,
    })
  }

  const kittensResult = mergeEntities(local.kittens, remote.kittens)
  for (const c of kittensResult.conflicts) {
    conflicts.push({
      entityType: 'kittens',
      id: c.id,
      local: c.local,
      remote: c.remote,
    })
  }

  const sessionsResult = mergeEntities(
    local.feedingSessions,
    remote.feedingSessions,
  )
  for (const c of sessionsResult.conflicts) {
    conflicts.push({
      entityType: 'feedingSessions',
      id: c.id,
      local: c.local,
      remote: c.remote,
    })
  }

  // WeightEntry has lastUpdatedAt named `timestamp`. Adapt via spread.
  const localEntriesAdapted = local.weightEntries.map((w) => ({
    ...w,
    lastUpdatedAt: w.timestamp,
  }))
  const remoteEntriesAdapted = remote.weightEntries.map((w) => ({
    ...w,
    lastUpdatedAt: w.timestamp,
  }))
  const entriesResult = mergeEntities(
    localEntriesAdapted,
    remoteEntriesAdapted,
  )
  // Strip the adapter field before returning.
  const mergedEntries = entriesResult.merged.map((w) => {
    const { lastUpdatedAt: _, ...rest } = w
    return rest
  })
  for (const c of entriesResult.conflicts) {
    const { lastUpdatedAt: _l, ...localRest } = c.local
    const { lastUpdatedAt: _r, ...remoteRest } = c.remote
    conflicts.push({
      entityType: 'weightEntries',
      id: c.id,
      local: localRest,
      remote: remoteRest,
    })
  }

  return {
    merged: {
      settings: settingsResult.merged,
      litters: littersResult.merged,
      kittens: kittensResult.merged,
      feedingSessions: sessionsResult.merged,
      weightEntries: mergedEntries,
    },
    conflicts,
  }
}
