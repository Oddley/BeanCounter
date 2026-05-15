import { hasStoredConnection, isAuthConfigured } from '../auth'
import { setSyncState } from './state'
import { runSync } from './orchestrator'

// On app start, set the sync indicator based on what's persisted, then
// fire a single silent sync if we have a stored connection.
//
// We deliberately do NOT request interactive OAuth at boot. Browsers
// require a user gesture to open OAuth popups (including the invisible
// frames GSI uses for `prompt: 'none'` in some browser/profile combos).
// If silent token refresh fails, the indicator will land in 'error' and
// the user can tap Sync now in Settings (a user gesture) to recover.
export function attemptBootReconnect(): void {
  if (!isAuthConfigured()) {
    return
  }
  if (!hasStoredConnection()) {
    setSyncState({ status: 'offline', errorMessage: '' })
    return
  }

  // Fire-and-forget. runSync sets its own indicator states throughout
  // (syncing → synced/dirty/error), so we don't need to await here.
  void runSync()
}
