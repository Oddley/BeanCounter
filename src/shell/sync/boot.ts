import { hasStoredConnection, isAuthConfigured } from '../auth'
import { setSyncState } from './state'

// On app start, set the sync indicator based on what's persisted.
//
// We deliberately do NOT attempt a silent OAuth refresh here. Browsers
// require a user gesture to open OAuth popups (including the invisible
// frames GSI uses for `prompt: 'none'` in some browser/profile combos),
// so a boot-time silent attempt either gets popup-blocked or fails
// outright. Token refresh happens lazily when a sync trigger fires
// (Phase 4d) or when the user explicitly taps Reconnect (Phase 4b).
export function attemptBootReconnect(): void {
  if (!isAuthConfigured()) {
    return
  }
  if (!hasStoredConnection()) {
    setSyncState({ status: 'unconnected', errorMessage: '' })
    return
  }
  setSyncState({
    status: 'pending',
    errorMessage: 'Tap to refresh your Drive connection',
  })
}
