import type { ActiveFileSnapshot } from '../active-file'
import type { AggregatedConflict } from './types'

// Bump the recency-tracking timestamp on each entity that won an auto-
// resolved conflict tie. Without this, every subsequent sync would re-
// detect the same tie (both sides still at the same lastUpdatedAt) and
// the chosen side would flip-flop between devices forever ("thrash").
//
// Bumping the winner's timestamp to `now` ensures the next sync sees a
// clear last-write-wins outcome — Drive's value is newer than the
// other device's local copy, so it just gets adopted, no new conflict
// detected.
//
// Most entities use `lastUpdatedAt`. WeightEntry is the exception: its
// recency field is named `timestamp` (set at the moment of entry, used
// by the merge code via an adapter). Bumping bumps the right field per
// entity type.
//
// Conflicts referencing entities not present in the merged snapshot
// are silently skipped (defensive — orchestrator should always pass
// coherent data, but we don't throw).
//
// Pure: never mutates inputs; returns a new snapshot.
export function bumpConflictWinners(
  merged: ActiveFileSnapshot,
  conflicts: readonly AggregatedConflict[],
  now: number,
): ActiveFileSnapshot {
  if (conflicts.length === 0) return merged

  const conflictIdsByType = {
    settings: new Set<string>(),
    litters: new Set<string>(),
    kittens: new Set<string>(),
    feedingSessions: new Set<string>(),
    weightEntries: new Set<string>(),
  }
  for (const c of conflicts) {
    conflictIdsByType[c.entityType].add(c.id)
  }

  const settings = conflictIdsByType.settings.size > 0
    ? { ...merged.settings, lastUpdatedAt: now }
    : merged.settings

  const litters = conflictIdsByType.litters.size > 0
    ? merged.litters.map((l) =>
        conflictIdsByType.litters.has(l.id)
          ? { ...l, lastUpdatedAt: now }
          : l,
      )
    : merged.litters

  const kittens = conflictIdsByType.kittens.size > 0
    ? merged.kittens.map((k) =>
        conflictIdsByType.kittens.has(k.id)
          ? { ...k, lastUpdatedAt: now }
          : k,
      )
    : merged.kittens

  const feedingSessions = conflictIdsByType.feedingSessions.size > 0
    ? merged.feedingSessions.map((s) =>
        conflictIdsByType.feedingSessions.has(s.id)
          ? { ...s, lastUpdatedAt: now }
          : s,
      )
    : merged.feedingSessions

  const weightEntries = conflictIdsByType.weightEntries.size > 0
    ? merged.weightEntries.map((w) =>
        conflictIdsByType.weightEntries.has(w.id)
          ? { ...w, timestamp: now }
          : w,
      )
    : merged.weightEntries

  return {
    settings,
    litters,
    kittens,
    feedingSessions,
    weightEntries,
  }
}
