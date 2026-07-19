import type { ActiveFile, ActiveFileSnapshot } from '../../core/active-file'

// ── InspectionResult ─────────────────────────────────────────────────────────
// The canonical result type returned by SyncBackend.inspect().
// Drive-specific fields (folderId, fileId, etag) have been removed; each
// backend stores what it needs internally and surfaces only the shared shape.

export interface InspectionEmpty {
  readonly kind: 'empty'
}

export interface InspectionExists {
  readonly kind: 'exists'
  readonly file: ActiveFile
  // Opaque optimistic-concurrency token captured at read time.
  // Drive: HTTP ETag.  Firebase: Firestore updateTime (ms as string).
  // Passed back to write() so the backend can reject a stale write.
  readonly concurrencyToken: string | null
}

export interface InspectionUnreadable {
  readonly kind: 'unreadable'
  readonly error: string
}

export type InspectionResult =
  | InspectionEmpty
  | InspectionExists
  | InspectionUnreadable

// ── Backend kinds ─────────────────────────────────────────────────────────────

export type BackendKind = 'offline' | 'drive' | 'firebase'

// ── SyncBackend interface ─────────────────────────────────────────────────────

export interface SyncBackend {
  readonly kind: BackendKind

  // Human-readable name shown in SyncButton and settings panels.
  // Empty string for the offline backend (indicator shows nothing).
  readonly displayName: string

  // True when the backend has enough stored config to attempt a sync.
  isConfigured(): boolean

  // Read remote state. Implementations should handle their own auth
  // internally. allowInteractive is forwarded from RunSyncOptions for
  // backends (Drive) that may need to open an auth popup; others ignore it.
  inspect(options?: { allowInteractive?: boolean }): Promise<InspectionResult>

  // Write the merged snapshot. concurrencyToken is whatever inspect()
  // returned; backends use it for optimistic concurrency checks and throw
  // a ConcurrencyConflictError on mismatch so the orchestrator can retry.
  // Returns the new token for informational purposes (orchestrator ignores it;
  // the next inspect() will capture a fresh one).
  write(
    snapshot: ActiveFileSnapshot,
    concurrencyToken: string | null,
  ): Promise<string | null>
}

// ── Errors ───────────────────────────────────────────────────────────────────

// Thrown by write() when the remote was modified since inspect() ran.
// The orchestrator catches this and retries the inspect→merge→write loop,
// identical to how it handles DriveError(412).
export class ConcurrencyConflictError extends Error {
  constructor(message = 'Concurrent modification — retry') {
    super(message)
    this.name = 'ConcurrencyConflictError'
  }
}

// Thrown by inspect() when interactive auth was needed but unavailable,
// or when the user cancelled. Maps to { kind: 'needs-auth' } in runSync.
export class NeedsAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NeedsAuthError'
  }
}
