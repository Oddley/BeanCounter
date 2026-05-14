import { NullAppSettings, type AppSettings } from '../settings'
import { type Litter } from '../litter'
import { type Kitten } from '../kitten'
import { type FeedingSession } from '../session'
import { type WeightEntry } from '../weight'
import {
  CURRENT_SCHEMA_VERSION,
  type ActiveFile,
  type ParseResult,
} from './types'

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
    settings:
      typeof obj.settings === 'object' && obj.settings !== null
        ? (obj.settings as AppSettings)
        : NullAppSettings,
    litters: Array.isArray(obj.litters) ? (obj.litters as Litter[]) : [],
    kittens: Array.isArray(obj.kittens) ? (obj.kittens as Kitten[]) : [],
    feedingSessions: Array.isArray(obj.feedingSessions)
      ? (obj.feedingSessions as FeedingSession[])
      : [],
    weightEntries: Array.isArray(obj.weightEntries)
      ? (obj.weightEntries as WeightEntry[])
      : [],
  }

  return { ok: true, file }
}
