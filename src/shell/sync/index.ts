export {
  getSyncState,
  setSyncState,
  useSyncState,
  type SyncState,
  type SyncStatus,
} from './state'

export {
  inspectDrive,
  snapshotLocal,
  pushLocalToActive,
  pullActiveToLocal,
  hasAnyLocalData,
  type InspectionResult,
  type InspectionEmpty,
  type InspectionExists,
  type InspectionUnreadable,
} from './first-connect'

export { attemptBootReconnect } from './boot'

export {
  runSync,
  getLastSyncedAt,
  type SyncRunResult,
  type RunSyncOptions,
} from './orchestrator'

export {
  markDirty,
  clearDirty,
  isDirty,
  getDirtySince,
} from './dirty'

export { installForegroundSync } from './foreground'
