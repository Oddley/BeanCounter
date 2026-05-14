import { type AppSettings } from '../settings'
import { type ActiveFileSnapshot } from '../active-file'

export interface SyncableEntity {
  readonly id: string
  readonly lastUpdatedAt: number
}

export interface MergeConflict<T> {
  readonly id: string
  readonly local: T
  readonly remote: T
}

export interface MergeResult<T> {
  readonly merged: readonly T[]
  readonly conflicts: readonly MergeConflict<T>[]
}

export interface SettingsMergeResult {
  readonly merged: AppSettings
  readonly conflict: MergeConflict<AppSettings> | null
}

export interface AggregatedConflict {
  readonly entityType:
    | 'settings'
    | 'litters'
    | 'kittens'
    | 'feedingSessions'
    | 'weightEntries'
  readonly id: string
  readonly local: unknown
  readonly remote: unknown
}

export interface SnapshotMergeResult {
  readonly merged: ActiveFileSnapshot
  readonly conflicts: readonly AggregatedConflict[]
}
