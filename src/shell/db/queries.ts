import { useLiveQuery } from 'dexie-react-hooks'
import { type Litter, NullLitter } from '../../core/litter'
import { type Kitten } from '../../core/kitten'
import { type AppSettings, NullAppSettings } from '../../core/settings'
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
  return useLiveQuery(
    () =>
      db.kittens
        .where('litterId')
        .equals(litterId)
        .filter((k) => k.active)
        .toArray(),
    [litterId],
  )
}

export function useArchivedKittens(litterId: string): Kitten[] | undefined {
  return useLiveQuery(
    () =>
      db.kittens
        .where('litterId')
        .equals(litterId)
        .filter((k) => !k.active)
        .toArray(),
    [litterId],
  )
}

export function useSettings(): AppSettings {
  const record = useLiveQuery(() => db.settings.get(SETTINGS_SINGLETON_ID))
  return record ?? NullAppSettings
}

export function useAllKittens(): Kitten[] | undefined {
  return useLiveQuery(() => db.kittens.toArray())
}
