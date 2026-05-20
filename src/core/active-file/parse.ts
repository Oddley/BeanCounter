import { NullAppSettings, type AppSettings } from '../settings'
import { NullLitter, type Litter } from '../litter'
import { NullKitten, type Kitten } from '../kitten'
import { NullFeedingSession, type FeedingSession } from '../session'
import { NullWeightEntry, type WeightEntry } from '../weight'
import {
  CURRENT_SCHEMA_VERSION,
  type ActiveFile,
  type ParseResult,
} from './types'

// Normalize each parsed entity to the current type shape by spreading
// the Null Object first, then the raw data. Effect: fields present in
// the raw JSON keep their values; fields ADDED to the type after this
// file was written get filled in from NullX defaults.
//
// Why this matters for sync: the per-entity merge uses deepEqual on
// tie-break. If local Dexie has `{ ..., deleted: false }` (post-
// migration) but Drive's JSON has `{ ... }` (written before that field
// existed), deepEqual returns false and the merge flags it as a
// conflict — even though the two values are semantically the same.
// Normalizing here means both sides produce identical in-memory shape
// and the equality check works as expected. This is the load-bearing
// schema-evolution invariant: any new field on a synced entity is
// safe as long as the corresponding NullX gets the same default.
function normalizeOne<T>(nullVal: T, raw: unknown): T {
  if (raw === null || typeof raw !== 'object') return nullVal
  return { ...nullVal, ...(raw as Partial<T>) }
}
function normalizeArray<T>(nullVal: T, raw: unknown): T[] {
  if (!Array.isArray(raw)) return []
  return raw.map((r) => normalizeOne(nullVal, r))
}

export function parseActiveFile(text: string): ParseResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'parse failure'
    return { ok: false, error: `Invalid JSON: ${msg}` }
  }
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    return { ok: false, error: 'Root must be a JSON object' }
  }

  const obj = json as Record<string, unknown>

  if (typeof obj.schemaVersion !== 'number') {
    return { ok: false, error: 'Missing or invalid schemaVersion' }
  }
  if (obj.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `File was written by a newer app (schemaVersion=${String(obj.schemaVersion)}); upgrade the app before reading`,
    }
  }
  if (obj.schemaVersion < CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `File uses an older schema (schemaVersion=${String(obj.schemaVersion)}); legacy upgrade is not supported`,
    }
  }

  const file: ActiveFile = {
    schemaVersion: obj.schemaVersion,
    settings: normalizeOne<AppSettings>(NullAppSettings, obj.settings),
    litters: normalizeArray<Litter>(NullLitter, obj.litters),
    kittens: normalizeArray<Kitten>(NullKitten, obj.kittens),
    feedingSessions: normalizeArray<FeedingSession>(
      NullFeedingSession,
      obj.feedingSessions,
    ),
    weightEntries: normalizeArray<WeightEntry>(
      NullWeightEntry,
      obj.weightEntries,
    ),
  }

  return { ok: true, file }
}
