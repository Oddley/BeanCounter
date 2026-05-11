import { useLiveQuery } from 'dexie-react-hooks'
import { type Litter, NullLitter } from '../../core/litter'
import { type Kitten } from '../../core/kitten'
import { type AppSettings } from '../../core/settings'
import { type FeedingSession } from '../../core/session'
import { type WeightEntry, weightEntryId } from '../../core/weight'
import { db, SETTINGS_SINGLETON_ID } from './dexie'

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
    const open = all.find((s) => !s.completed)
    return open ?? null
  }, [litterId])
}

export function useSession(
  sessionId: string,
): FeedingSession | undefined | null {
  return useLiveQuery(async () => {
    if (!sessionId) return null
    const found = await db.feedingSessions.get(sessionId)
    return found ?? null
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

export function useAllSessions(): FeedingSession[] | undefined {
  return useLiveQuery(() => db.feedingSessions.toArray())
}

export function useAllWeightEntries(): WeightEntry[] | undefined {
  return useLiveQuery(() => db.weightEntries.toArray())
}
