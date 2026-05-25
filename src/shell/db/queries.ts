import { useLiveQuery } from 'dexie-react-hooks'
import { type Litter, NullLitter } from '../../core/litter'
import { type Kitten } from '../../core/kitten'
import { type AppSettings } from '../../core/settings'
import { type FeedingSession, effectiveRecordedAt } from '../../core/session'
import { type WeightEntry, weightEntryId } from '../../core/weight'
import { db, SETTINGS_SINGLETON_ID, type ConflictRecord } from './dexie'

export function useActiveLitters(): Litter[] | undefined {
  return useLiveQuery(() => db.litters.filter((l) => l.active).toArray())
}

export function useArchivedLitters(): Litter[] | undefined {
  return useLiveQuery(() => db.litters.filter((l) => !l.active).toArray())
}

export function useAllLitters(): Litter[] | undefined {
  return useLiveQuery(() => db.litters.toArray())
}

export function useLitter(id: string): Litter | undefined {
  return useLiveQuery(async () => {
    if (!id) return NullLitter
    const found = await db.litters.get(id)
    return found ?? NullLitter
  }, [id])
}

export function useActiveKittens(litterId: string): Kitten[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.kittens.where('litterId').equals(litterId).toArray()
    return all.filter((k) => k.active).sort((a, b) => a.order - b.order)
  }, [litterId])
}

export function useArchivedKittens(litterId: string): Kitten[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.kittens.where('litterId').equals(litterId).toArray()
    return all.filter((k) => !k.active).sort((a, b) => a.order - b.order)
  }, [litterId])
}

export function useSettings(): AppSettings | undefined {
  return useLiveQuery(() => db.settings.get(SETTINGS_SINGLETON_ID))
}

export function useAllKittens(): Kitten[] | undefined {
  return useLiveQuery(() => db.kittens.toArray())
}

export function useOpenSessionForLitter(
  litterId: string,
): FeedingSession | undefined | null {
  // null = resolved but no open session for this litter
  // undefined = still loading
  return useLiveQuery(async () => {
    if (!litterId) return null
    const all = await db.feedingSessions
      .where('litterId')
      .equals(litterId)
      .toArray()
    const open = all.find((s) => !s.completed && !s.deleted)
    return open ?? null
  }, [litterId])
}

export function useSession(
  sessionId: string,
): FeedingSession | undefined | null {
  return useLiveQuery(async () => {
    if (!sessionId) return null
    const found = await db.feedingSessions.get(sessionId)
    if (!found || found.deleted) return null
    return found
  }, [sessionId])
}

export function useWeightEntriesForSession(
  sessionId: string,
): WeightEntry[] | undefined {
  return useLiveQuery(
    () =>
      db.weightEntries.where('sessionId').equals(sessionId).toArray(),
    [sessionId],
  )
}

export function useWeightForKittenInSession(
  sessionId: string,
  kittenId: string,
): WeightEntry | undefined | null {
  return useLiveQuery(async () => {
    if (!sessionId || !kittenId) return null
    const found = await db.weightEntries.get(weightEntryId(sessionId, kittenId))
    return found ?? null
  }, [sessionId, kittenId])
}

export function useLastCompletedSessionForLitter(
  litterId: string,
): FeedingSession | undefined | null {
  // undefined = loading, null = no completed session exists
  return useLiveQuery(async () => {
    if (!litterId) return null
    const all = await db.feedingSessions
      .where('litterId')
      .equals(litterId)
      .toArray()
    const completed = all.filter((s) => s.completed && !s.deleted)
    if (completed.length === 0) return null
    return completed.reduce((best, s) =>
      effectiveRecordedAt(s) > effectiveRecordedAt(best) ? s : best,
    )
  }, [litterId])
}

export function useAllSessions(): FeedingSession[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.feedingSessions.toArray()
    return all.filter((s) => !s.deleted)
  })
}

// Includes tombstoned (deleted=true) sessions. Used only by Debug
// for restore-after-accidental-delete recovery; user-facing routes
// should stick with useAllSessions which hides tombstones.
export function useAllSessionsIncludingDeleted(): FeedingSession[] | undefined {
  return useLiveQuery(() => db.feedingSessions.toArray())
}

export function useAllWeightEntries(): WeightEntry[] | undefined {
  return useLiveQuery(() => db.weightEntries.toArray())
}

// Conflict resolution UI consumes these. Live-query so the conflict
// page re-renders as records are added (on sync) or removed (on
// resolution).
export function useConflicts(): ConflictRecord[] | undefined {
  return useLiveQuery(() => db.conflicts.toArray())
}

export function useConflictCount(): number | undefined {
  return useLiveQuery(() => db.conflicts.count())
}
