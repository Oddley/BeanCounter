import { hasStoredConnection } from '../auth'
import { runSync, getLastSyncedAt } from './orchestrator'

const FOREGROUND_STALENESS_MS = 10 * 60 * 1000

let installed = false

// Wire a visibilitychange listener: when the document becomes visible
// AND we have a stored Drive connection AND it's been >10min since the
// last sync, trigger a pull. Idempotent — calling installForegroundSync
// twice is a no-op.
export function installForegroundSync(): void {
  if (installed) return
  if (typeof document === 'undefined') return
  installed = true

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    if (!hasStoredConnection()) return
    const elapsed = Date.now() - getLastSyncedAt()
    if (elapsed < FOREGROUND_STALENESS_MS) return
    void runSync()
  })
}
