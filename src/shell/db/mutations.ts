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
  deleteSession,
  setRecordedAt,
  clearRecordedAt,
  type FeedingSession,
} from '../../core/session'
import {
  createWeightEntry,
  type WeightEntry,
} from '../../core/weight'
import { type AggregatedConflict } from '../../core/sync'
import { newId } from '../../core/ids'
import {
  db,
  SETTINGS_SINGLETON_ID,
  type SettingsRecord,
  type ConflictRecord,
  type ConflictEntityType,
  conflictRecordId,
} from './dexie'
// Import directly from dirty.ts (not the sync barrel) to avoid pulling
// in orchestrator.ts and creating a circular import via shell/db.
import { markDirty } from '../sync/dirty'

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

  markDirty()
  return { litter, kittens }
}

export async function archiveLitterById(id: string): Promise<void> {
  const found = (await db.litters.get(id)) ?? NullLitter
  if (!found.id) return
  await db.litters.put(archiveLitter(found, Date.now()))
  markDirty()
}

export async function activateLitterById(id: string): Promise<void> {
  const found = (await db.litters.get(id)) ?? NullLitter
  if (!found.id) return
  await db.litters.put(activateLitter(found, Date.now()))
  markDirty()
}

export async function renameLitterById(
  id: string,
  newName: string,
): Promise<void> {
  const found = (await db.litters.get(id)) ?? NullLitter
  if (!found.id) return
  await db.litters.put(renameLitter(found, newName, Date.now()))
  markDirty()
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
  markDirty()
  return kitten
}

export async function archiveKittenById(id: string): Promise<void> {
  const found = (await db.kittens.get(id)) ?? NullKitten
  if (!found.id) return
  await db.kittens.put(archiveKitten(found, Date.now()))
  markDirty()
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
  markDirty()
}

export async function renameKittenById(
  id: string,
  newDisplayName: string,
): Promise<void> {
  const found = (await db.kittens.get(id)) ?? NullKitten
  if (!found.id) return
  await db.kittens.put(renameKitten(found, newDisplayName, Date.now()))
  markDirty()
}

async function readSettings(): Promise<SettingsRecord> {
  const found = await db.settings.get(SETTINGS_SINGLETON_ID)
  return found ?? { ...NullAppSettings, id: SETTINGS_SINGLETON_ID }
}

export async function setStickyLitterById(litterId: string): Promise<void> {
  const current = await readSettings()
  const next = setStickyLitter(current, litterId, Date.now())
  await db.settings.put({ ...next, id: SETTINGS_SINGLETON_ID })
  markDirty()
}

export async function clearStickyLitterById(): Promise<void> {
  const current = await readSettings()
  const next = clearStickyLitter(current, Date.now())
  await db.settings.put({ ...next, id: SETTINGS_SINGLETON_ID })
  markDirty()
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
  markDirty()
}

export async function ensureOpenSessionForLitter(
  litterId: string,
  now: number,
): Promise<FeedingSession> {
  const all = await db.feedingSessions
    .where('litterId')
    .equals(litterId)
    .toArray()
  const existing = all.find((s) => !s.completed && !s.deleted)
  if (existing) return existing

  const session = createSession({
    id: newId(),
    litterId,
    createdAt: now,
  })
  await db.feedingSessions.add(session)
  markDirty()
  return session
}

export async function touchSessionById(
  sessionId: string,
  now: number,
): Promise<void> {
  const session = await db.feedingSessions.get(sessionId)
  if (!session) return
  await db.feedingSessions.put(touchSession(session, now))
  markDirty()
}

export async function completeSessionById(sessionId: string): Promise<void> {
  const session = await db.feedingSessions.get(sessionId)
  if (!session) return
  await db.feedingSessions.put(completeSession(session))
  markDirty()
}

// Soft-delete a feeding session by setting its `deleted` tombstone
// flag and bumping `lastUpdatedAt`. Physical removal is unsafe in the
// sync model — a missing-on-local entity is indistinguishable from
// "remote has it but I haven't pulled yet," so the next merge would
// resurrect it from Drive. The tombstone makes the deletion explicit
// and LWW propagates it to peers.
//
// Weight entries pointing at this session are left in place. They're
// invisible at read time (no non-deleted session references them) and
// occupy negligible space at foster-mama scale. A future cleanup pass
// could physically prune entries of long-deleted sessions if needed.
//
// No-op if the session doesn't exist locally.
//
// Caller is expected to have confirmed with the user — this is
// user-facing destructive UX from the graph's Delete button.
export async function deleteSessionById(sessionId: string): Promise<void> {
  const session = await db.feedingSessions.get(sessionId)
  if (!session) return
  await db.feedingSessions.put(deleteSession(session, Date.now()))
  markDirty()
}

export async function setSessionRecordedAtById(
  sessionId: string,
  time: number,
): Promise<void> {
  const session = await db.feedingSessions.get(sessionId)
  if (!session) return
  await db.feedingSessions.put(setRecordedAt(session, time))
  markDirty()
}

export async function clearSessionRecordedAtById(
  sessionId: string,
): Promise<void> {
  const session = await db.feedingSessions.get(sessionId)
  if (!session) return
  await db.feedingSessions.put(clearRecordedAt(session))
  markDirty()
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
  const existing = all.find((s) => !s.completed && !s.deleted)
  if (existing) {
    if (recordedAt > 0 && existing.recordedAt !== recordedAt) {
      const updated = setRecordedAt(existing, recordedAt)
      await db.feedingSessions.put(updated)
      markDirty()
      return updated
    }
    return existing
  }
  const base = createSession({ id: newId(), litterId, createdAt: now })
  const session = recordedAt > 0 ? setRecordedAt(base, recordedAt) : base
  await db.feedingSessions.add(session)
  markDirty()
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
  markDirty()
  return entry
}

export async function wipeAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.litters,
      db.kittens,
      db.settings,
      db.feedingSessions,
      db.weightEntries,
      db.conflicts,
    ],
    async () => {
      await db.litters.clear()
      await db.kittens.clear()
      await db.feedingSessions.clear()
      await db.weightEntries.clear()
      await db.conflicts.clear()
      await db.settings.clear()
      await db.settings.add({
        ...NullAppSettings,
        id: SETTINGS_SINGLETON_ID,
      })
    },
  )
  markDirty()
}

// Conflict persistence + resolution mutations.
//
// Conflicts are local-only state (per ADR-007 multi-user follow-up):
// each device captures the conflicts it personally detected during
// merge. Resolving a conflict on one device propagates the chosen
// version via the next sync (the resolver bumps the entity's recency
// timestamp so it wins the next merge).
//
// persistConflict is idempotent on the entity — re-detecting the same
// entity's conflict overwrites the previous record (so we don't
// accumulate duplicate records for the same entity over multiple
// syncs).

export async function persistConflict(
  conflict: AggregatedConflict,
  now: number,
): Promise<void> {
  const id = conflictRecordId(conflict.entityType, conflict.id)
  const record: ConflictRecord = {
    id,
    entityType: conflict.entityType,
    entityId: conflict.id,
    localVersion: conflict.local,
    remoteVersion: conflict.remote,
    detectedAt: now,
  }
  await db.conflicts.put(record)
  // No markDirty: the entity itself was already bumped by
  // bumpConflictWinners in the orchestrator before persistConflict runs,
  // which is what actually moves the user-visible data.
}

// Shared helper: write the chosen version back to the appropriate
// entity table with a fresh recency timestamp, then delete the
// conflict record. The recency field differs by type:
//   - settings/litters/kittens/feedingSessions: lastUpdatedAt
//   - weightEntries: timestamp
async function writeChosenVersionAndClear(
  entityType: ConflictEntityType,
  chosen: unknown,
  conflictId: string,
  now: number,
): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.settings,
      db.litters,
      db.kittens,
      db.feedingSessions,
      db.weightEntries,
      db.conflicts,
    ],
    async () => {
      switch (entityType) {
        case 'settings': {
          const next = {
            ...(chosen as SettingsRecord),
            id: SETTINGS_SINGLETON_ID,
            lastUpdatedAt: now,
          }
          await db.settings.put(next)
          break
        }
        case 'litters': {
          const next = { ...(chosen as Litter), lastUpdatedAt: now }
          await db.litters.put(next)
          break
        }
        case 'kittens': {
          const next = { ...(chosen as Kitten), lastUpdatedAt: now }
          await db.kittens.put(next)
          break
        }
        case 'feedingSessions': {
          const next = { ...(chosen as FeedingSession), lastUpdatedAt: now }
          await db.feedingSessions.put(next)
          break
        }
        case 'weightEntries': {
          const next = { ...(chosen as WeightEntry), timestamp: now }
          await db.weightEntries.put(next)
          break
        }
      }
      await db.conflicts.delete(conflictId)
    },
  )
  markDirty()
}

export async function resolveConflictAsLocal(
  conflictId: string,
  now: number,
): Promise<void> {
  const conflict = await db.conflicts.get(conflictId)
  if (!conflict) return
  await writeChosenVersionAndClear(
    conflict.entityType,
    conflict.localVersion,
    conflictId,
    now,
  )
}

export async function resolveConflictAsRemote(
  conflictId: string,
  now: number,
): Promise<void> {
  const conflict = await db.conflicts.get(conflictId)
  if (!conflict) return
  await writeChosenVersionAndClear(
    conflict.entityType,
    conflict.remoteVersion,
    conflictId,
    now,
  )
}
