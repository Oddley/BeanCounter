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
  reassignOrders,
  type Kitten,
  NullKitten,
} from '../../core/kitten'
import {
  setStickyLitter,
  clearStickyLitter,
  NullAppSettings,
} from '../../core/settings'
import {
  createSession,
  touchSession,
  completeSession,
  setRecordedAt,
  clearRecordedAt,
  type FeedingSession,
} from '../../core/session'
import {
  createWeightEntry,
  type WeightEntry,
} from '../../core/weight'
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
  const now = Date.now()
  const litterId = newId()
  const litter = createLitter({ id: litterId, name: input.name, now })
  const kittens = input.kittens.map((k, i) =>
    createKitten({
      id: newId(),
      litterId,
      displayName: k.displayName.trim() || defaultKittenName(i + 1),
      order: i,
      now,
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
  await db.litters.put(archiveLitter(found, Date.now()))
}

export async function activateLitterById(id: string): Promise<void> {
  const found = (await db.litters.get(id)) ?? NullLitter
  if (!found.id) return
  await db.litters.put(activateLitter(found, Date.now()))
}

export async function renameLitterById(
  id: string,
  newName: string,
): Promise<void> {
  const found = (await db.litters.get(id)) ?? NullLitter
  if (!found.id) return
  await db.litters.put(renameLitter(found, newName, Date.now()))
}

export async function persistNewKitten(input: {
  litterId: string
  displayName: string
}): Promise<Kitten> {
  const siblings = await db.kittens
    .where('litterId')
    .equals(input.litterId)
    .toArray()
  const maxOrder = siblings.reduce((m, k) => Math.max(m, k.order), -1)
  const kitten = createKitten({
    id: newId(),
    litterId: input.litterId,
    displayName: input.displayName,
    order: maxOrder + 1,
    now: Date.now(),
  })
  await db.kittens.add(kitten)
  return kitten
}

export async function archiveKittenById(id: string): Promise<void> {
  const found = (await db.kittens.get(id)) ?? NullKitten
  if (!found.id) return
  await db.kittens.put(archiveKitten(found, Date.now()))
}

export async function activateKittenById(id: string): Promise<void> {
  const found = (await db.kittens.get(id)) ?? NullKitten
  if (!found.id) return
  const siblings = await db.kittens
    .where('litterId')
    .equals(found.litterId)
    .toArray()
  const maxActiveOrder = siblings
    .filter((k) => k.active && k.id !== found.id)
    .reduce((m, k) => Math.max(m, k.order), -1)
  const restored = activateKitten(found, Date.now())
  await db.kittens.put({ ...restored, order: maxActiveOrder + 1 })
}

export async function renameKittenById(
  id: string,
  newDisplayName: string,
): Promise<void> {
  const found = (await db.kittens.get(id)) ?? NullKitten
  if (!found.id) return
  await db.kittens.put(renameKitten(found, newDisplayName, Date.now()))
}

async function readSettings(): Promise<SettingsRecord> {
  const found = await db.settings.get(SETTINGS_SINGLETON_ID)
  return found ?? { ...NullAppSettings, id: SETTINGS_SINGLETON_ID }
}

export async function setStickyLitterById(litterId: string): Promise<void> {
  const current = await readSettings()
  const next = setStickyLitter(current, litterId, Date.now())
  await db.settings.put({ ...next, id: SETTINGS_SINGLETON_ID })
}

export async function clearStickyLitterById(): Promise<void> {
  const current = await readSettings()
  const next = clearStickyLitter(current, Date.now())
  await db.settings.put({ ...next, id: SETTINGS_SINGLETON_ID })
}

export async function persistKittenOrder(
  orderedKittens: readonly Kitten[],
): Promise<void> {
  const now = Date.now()
  const reassigned = reassignOrders(orderedKittens).map((k) => ({
    ...k,
    lastUpdatedAt: now,
  }))
  await db.kittens.bulkPut(reassigned)
}

export async function ensureOpenSessionForLitter(
  litterId: string,
  now: number,
): Promise<FeedingSession> {
  const all = await db.feedingSessions
    .where('litterId')
    .equals(litterId)
    .toArray()
  const existing = all.find((s) => !s.completed)
  if (existing) return existing

  const session = createSession({
    id: newId(),
    litterId,
    createdAt: now,
  })
  await db.feedingSessions.add(session)
  return session
}

export async function touchSessionById(
  sessionId: string,
  now: number,
): Promise<void> {
  const session = await db.feedingSessions.get(sessionId)
  if (!session) return
  await db.feedingSessions.put(touchSession(session, now))
}

export async function completeSessionById(sessionId: string): Promise<void> {
  const session = await db.feedingSessions.get(sessionId)
  if (!session) return
  await db.feedingSessions.put(completeSession(session))
}

export async function setSessionRecordedAtById(
  sessionId: string,
  time: number,
): Promise<void> {
  const session = await db.feedingSessions.get(sessionId)
  if (!session) return
  await db.feedingSessions.put(setRecordedAt(session, time))
}

export async function clearSessionRecordedAtById(
  sessionId: string,
): Promise<void> {
  const session = await db.feedingSessions.get(sessionId)
  if (!session) return
  await db.feedingSessions.put(clearRecordedAt(session))
}

export async function ensureOpenSessionWithRecordedAt(
  litterId: string,
  now: number,
  recordedAt: number,
): Promise<FeedingSession> {
  const all = await db.feedingSessions
    .where('litterId')
    .equals(litterId)
    .toArray()
  const existing = all.find((s) => !s.completed)
  if (existing) {
    if (recordedAt > 0 && existing.recordedAt !== recordedAt) {
      const updated = setRecordedAt(existing, recordedAt)
      await db.feedingSessions.put(updated)
      return updated
    }
    return existing
  }
  const base = createSession({ id: newId(), litterId, createdAt: now })
  const session = recordedAt > 0 ? setRecordedAt(base, recordedAt) : base
  await db.feedingSessions.add(session)
  return session
}

export async function persistWeightEntry(input: {
  sessionId: string
  kittenId: string
  grams: number
  now: number
}): Promise<WeightEntry> {
  const entry = createWeightEntry({
    sessionId: input.sessionId,
    kittenId: input.kittenId,
    grams: input.grams,
    timestamp: input.now,
    clientWriteId: newId(),
  })
  await db.transaction('rw', db.weightEntries, db.feedingSessions, async () => {
    await db.weightEntries.put(entry)
    const session = await db.feedingSessions.get(input.sessionId)
    if (session) {
      await db.feedingSessions.put(touchSession(session, input.now))
    }
  })
  return entry
}

export async function wipeAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.litters, db.kittens, db.settings, db.feedingSessions, db.weightEntries],
    async () => {
      await db.litters.clear()
      await db.kittens.clear()
      await db.feedingSessions.clear()
      await db.weightEntries.clear()
      await db.settings.clear()
      await db.settings.add({
        ...NullAppSettings,
        id: SETTINGS_SINGLETON_ID,
      })
    },
  )
}
