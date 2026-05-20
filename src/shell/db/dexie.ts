import Dexie, { type Table, type Transaction } from 'dexie'
import { type Litter } from '../../core/litter'
import { type Kitten } from '../../core/kitten'
import { type AppSettings, NullAppSettings } from '../../core/settings'
import { type FeedingSession } from '../../core/session'
import { type WeightEntry } from '../../core/weight'

export interface SettingsRecord extends AppSettings {
  readonly id: 'singleton'
}

// One conflict record per entity that the local device's most recent
// sync detected as a tie-with-different-content. Persisted across app
// restarts so the user can resolve at their leisure (per ADR-007 +
// approach A: auto-resolve to local-wins, surface UI for retroactive
// review). See src/shell/routes/ConflictResolution.tsx for the UI.
export type ConflictEntityType =
  | 'settings'
  | 'litters'
  | 'kittens'
  | 'feedingSessions'
  | 'weightEntries'

export interface ConflictRecord {
  // Composite key: `${entityType}:${entityId}`. Splitting on the FIRST
  // colon is correct — weightEntries' entityId contains an internal
  // colon (`${sessionId}:${kittenId}`) which we preserve as-is.
  readonly id: string
  readonly entityType: ConflictEntityType
  readonly entityId: string
  readonly localVersion: unknown
  readonly remoteVersion: unknown
  readonly detectedAt: number
}

// Build the deterministic conflict id. Re-detecting the same entity's
// conflict produces the same id, so persistConflict can upsert
// idempotently rather than accumulating duplicates.
export function conflictRecordId(
  entityType: ConflictEntityType,
  entityId: string,
): string {
  return `${entityType}:${entityId}`
}

export const SETTINGS_SINGLETON_ID = 'singleton' as const

interface LegacyKittenV1 {
  id: string
  displayName: string
  active: boolean
  litterId: string
}

export class BeanCounterDB extends Dexie {
  litters!: Table<Litter, string>
  kittens!: Table<Kitten, string>
  settings!: Table<SettingsRecord, 'singleton'>
  feedingSessions!: Table<FeedingSession, string>
  weightEntries!: Table<WeightEntry, string>
  conflicts!: Table<ConflictRecord, string>

  constructor() {
    super('beancounter')

    this.version(1).stores({
      litters: 'id',
      kittens: 'id, litterId',
      settings: 'id',
    })

    this.version(2)
      .stores({
        litters: 'id',
        kittens: 'id, litterId',
        settings: 'id',
      })
      .upgrade(backfillKittenOrder)

    this.version(3).stores({
      litters: 'id',
      kittens: 'id, litterId',
      settings: 'id',
      feedingSessions: 'id, litterId',
      weightEntries: 'id, sessionId, kittenId',
    })

    this.version(4)
      .stores({
        litters: 'id',
        kittens: 'id, litterId',
        settings: 'id',
        feedingSessions: 'id, litterId',
        weightEntries: 'id, sessionId, kittenId',
      })
      .upgrade(backfillSessionRecordedAt)

    // v4 → v5: add the `conflicts` table. New table starts empty;
    // no data migration needed. Existing local data passes through
    // untouched.
    this.version(5).stores({
      litters: 'id',
      kittens: 'id, litterId',
      settings: 'id',
      feedingSessions: 'id, litterId',
      weightEntries: 'id, sessionId, kittenId',
      conflicts: 'id, entityType',
    })

    // v5 → v6: add `deleted: boolean` tombstone field on feeding
    // sessions. Default `false` on existing rows. Required to make
    // delete-feeding survive a sync round-trip — physical deletes get
    // resurrected by the merge (local-missing vs remote-has-it is
    // indistinguishable from "I just haven't seen it yet"). Tombstones
    // make the deletion explicit so LWW resolves it correctly.
    this.version(6)
      .stores({
        litters: 'id',
        kittens: 'id, litterId',
        settings: 'id',
        feedingSessions: 'id, litterId',
        weightEntries: 'id, sessionId, kittenId',
        conflicts: 'id, entityType',
      })
      .upgrade(backfillSessionDeleted)

    this.on('populate', () => {
      this.settings.add({ ...NullAppSettings, id: SETTINGS_SINGLETON_ID })
    })
  }
}

async function backfillSessionRecordedAt(tx: Transaction): Promise<void> {
  // v3 → v4 upgrade: pre-`deleted` records, so we explicitly set
  // deleted: false to match the current FeedingSession shape. The
  // v5 → v6 migration also backfills this, but doing it here keeps
  // each schema version's resulting shape consistent with its time.
  const sessions = (await tx
    .table('feedingSessions')
    .toArray()) as Array<
    FeedingSession & { recordedAt?: number; deleted?: boolean }
  >
  const updated: FeedingSession[] = sessions.map((s) => ({
    id: s.id,
    litterId: s.litterId,
    createdAt: s.createdAt,
    lastUpdatedAt: s.lastUpdatedAt,
    recordedAt: s.recordedAt ?? 0,
    completed: s.completed,
    lockAcquired: s.lockAcquired,
    deleted: s.deleted ?? false,
  }))
  if (updated.length > 0) {
    await tx.table('feedingSessions').bulkPut(updated)
  }
}

async function backfillSessionDeleted(tx: Transaction): Promise<void> {
  // v5 → v6: any session row that pre-dates the `deleted` field gets
  // an explicit false. After this, every session record has the field
  // set in storage, and the FeedingSession type's required `deleted`
  // is satisfied by reads.
  const sessions = (await tx
    .table('feedingSessions')
    .toArray()) as Array<FeedingSession & { deleted?: boolean }>
  const updated: FeedingSession[] = sessions.map((s) => ({
    id: s.id,
    litterId: s.litterId,
    createdAt: s.createdAt,
    lastUpdatedAt: s.lastUpdatedAt,
    recordedAt: s.recordedAt,
    completed: s.completed,
    lockAcquired: s.lockAcquired,
    deleted: s.deleted ?? false,
  }))
  if (updated.length > 0) {
    await tx.table('feedingSessions').bulkPut(updated)
  }
}

async function backfillKittenOrder(tx: Transaction): Promise<void> {
  const kittens = (await tx
    .table('kittens')
    .toArray()) as LegacyKittenV1[]
  const byLitter = new Map<string, LegacyKittenV1[]>()
  for (const k of kittens) {
    const group = byLitter.get(k.litterId) ?? []
    group.push(k)
    byLitter.set(k.litterId, group)
  }
  const updated: Kitten[] = []
  for (const group of byLitter.values()) {
    group.sort((a, b) => a.id.localeCompare(b.id))
    for (let i = 0; i < group.length; i++) {
      const k = group[i]
      if (k === undefined) continue
      updated.push({
        id: k.id,
        displayName: k.displayName,
        active: k.active,
        litterId: k.litterId,
        order: i,
        lastUpdatedAt: 0,
      })
    }
  }
  if (updated.length > 0) {
    await tx.table('kittens').bulkPut(updated)
  }
}

export const db = new BeanCounterDB()
