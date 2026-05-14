import { type Litter } from '../litter'
import { type Kitten } from '../kitten'
import { type FeedingSession } from '../session'
import { type WeightEntry } from '../weight'
import { type AppSettings } from '../settings'

export const CURRENT_SCHEMA_VERSION = 1 as const

export interface ActiveFile {
  readonly schemaVersion: number
  readonly settings: AppSettings
  readonly litters: readonly Litter[]
  readonly kittens: readonly Kitten[]
  readonly feedingSessions: readonly FeedingSession[]
  readonly weightEntries: readonly WeightEntry[]
}

export interface ActiveFileSnapshot {
  readonly settings: AppSettings
  readonly litters: readonly Litter[]
  readonly kittens: readonly Kitten[]
  readonly feedingSessions: readonly FeedingSession[]
  readonly weightEntries: readonly WeightEntry[]
}

export type ParseResult =
  | { readonly ok: true; readonly file: ActiveFile }
  | { readonly ok: false; readonly error: string }
