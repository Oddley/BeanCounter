export {
  getSyncState,
  setSyncState,
  useSyncState,
  type SyncState,
  type SyncStatus,
} from './state'

// Generic inspection result types (backend-agnostic).
export type {
  InspectionResult,
  InspectionEmpty,
  InspectionExists,
  InspectionUnreadable,
  BackendKind,
  SyncBackend,
} from './backend'

export {
  ConcurrencyConflictError,
  NeedsAuthError,
} from './backend'

// Registry: active backend selection.
export {
  getActiveBackend,
  setActiveBackend,
  useActiveBackendKind,
  getStoredBackendKind,
} from './backends/registry'

export { attemptBootReconnect } from './boot'

export {
  runSync,
  getLastSyncedAt,
  type SyncRunResult,
  type RunSyncOptions,
} from './orchestrator'

export { triggerManualSync } from './actions'

export {
  markDirty,
  clearDirty,
  isDirty,
  getDirtySince,
} from './dirty'

// Drive-specific helpers used by Invite.tsx and SetupSync drive path.
// These are explicitly Drive-scoped; other backends don't expose equivalents.
export {
  inspectDrive,
  snapshotLocal,
  pushLocalToActive,
  pullActiveToLocal,
  hasAnyLocalData,
} from './first-connect'
