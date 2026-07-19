import { wakeSidecarIfNeeded } from './sidecar'
import { runSync } from './orchestrator'

/**
 * Fires a user-initiated sync. Call directly from a click handler — the
 * synchronous wakeSidecarIfNeeded() call must run before any `await` so a
 * beancounter-sync:// wake still counts as gesture-initiated to Chrome.
 */
export function triggerManualSync(): void {
  wakeSidecarIfNeeded()
  void runSync({ allowInteractive: true })
}
