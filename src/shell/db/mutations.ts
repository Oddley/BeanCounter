import {
  createLitter,
  archiveLitter,
  activateLitter,
  renameLitter,
  type Litter,
  NullLitter,
} from '../../core/litter'
import {
  createKitten,
  archiveKitten,
  activateKitten,
  renameKitten,
  defaultKittenName,
  type Kitten,
  NullKitten,
} from '../../core/kitten'
import {
  setStickyLitter,
  clearStickyLitter,
  NullAppSettings,
} from '../../core/settings'
import { newId } from '../../core/ids'
import { db, SETTINGS_SINGLETON_ID, type SettingsRecord } from './dexie'

export interface NewLitterInput {
  readonly name: string
  readonly kittens: readonly { readonly displayName: string }[]
}

export interface NewLitterResult {
  readonly litter: Litter
  readonly kittens: readonly Kitten[]
}

export async function persistNewLitter(
  input: NewLitterInput,
): Promise<NewLitterResult> {
  const litterId = newId()
  const litter = createLitter({ id: litterId, name: input.name })
  const kittens = input.kittens.map((k, i) =>
    createKitten({
      id: newId(),
      litterId,
      displayName: k.displayName.trim() || defaultKittenName(i + 1),
    }),
  )

  await db.transaction('rw', db.litters, db.kittens, async () => {
    await db.litters.add(litter)
    await db.kittens.bulkAdd([...kittens])
  })

  return { litter, kittens }
}

export async function archiveLitterById(id: string): Promise<void> {
  const found = (await db.litters.get(id)) ?? NullLitter
  if (!found.id) return
  await db.litters.put(archiveLitter(found))
}

export async function activateLitterById(id: string): Promise<void> {
  const found = (await db.litters.get(id)) ?? NullLitter
  if (!found.id) return
  await db.litters.put(activateLitter(found))
}

export async function renameLitterById(
  id: string,
  newName: string,
): Promise<void> {
  const found = (await db.litters.get(id)) ?? NullLitter
  if (!found.id) return
  await db.litters.put(renameLitter(found, newName))
}

export async function persistNewKitten(input: {
  litterId: string
  displayName: string
}): Promise<Kitten> {
  const kitten = createKitten({
    id: newId(),
    litterId: input.litterId,
    displayName: input.displayName,
  })
  await db.kittens.add(kitten)
  return kitten
}

export async function archiveKittenById(id: string): Promise<void> {
  const found = (await db.kittens.get(id)) ?? NullKitten
  if (!found.id) return
  await db.kittens.put(archiveKitten(found))
}

export async function activateKittenById(id: string): Promise<void> {
  const found = (await db.kittens.get(id)) ?? NullKitten
  if (!found.id) return
  await db.kittens.put(activateKitten(found))
}

export async function renameKittenById(
  id: string,
  newDisplayName: string,
): Promise<void> {
  const found = (await db.kittens.get(id)) ?? NullKitten
  if (!found.id) return
  await db.kittens.put(renameKitten(found, newDisplayName))
}

async function readSettings(): Promise<SettingsRecord> {
  const found = await db.settings.get(SETTINGS_SINGLETON_ID)
  return found ?? { ...NullAppSettings, id: SETTINGS_SINGLETON_ID }
}

export async function setStickyLitterById(litterId: string): Promise<void> {
  const current = await readSettings()
  const next = setStickyLitter(current, litterId)
  await db.settings.put({ ...next, id: SETTINGS_SINGLETON_ID })
}

export async function clearStickyLitterById(): Promise<void> {
  const current = await readSettings()
  const next = clearStickyLitter(current)
  await db.settings.put({ ...next, id: SETTINGS_SINGLETON_ID })
}
