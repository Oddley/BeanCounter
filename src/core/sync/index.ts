export type {
  SyncableEntity,
  MergeConflict,
  MergeResult,
  SettingsMergeResult,
  AggregatedConflict,
  SnapshotMergeResult,
} from './types'

export { deepEqual } from './deep-equal'
export { mergeEntities, mergeSettings, mergeSnapshots } from './merge'
export { bumpConflictWinners } from './bump-conflict-winners'
