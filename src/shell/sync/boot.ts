import { setSyncState } from './state'
import { runSync } from './orchestrator'
import { getActiveBackend } from './backends/registry'

// On app start, fire a single silent sync if the active backend is configured.
// We deliberately do NOT allow interactive auth at boot — browsers require a
// user gesture to open OAuth popups. If silent refresh fails the indicator
// lands in 'error' and the user can tap "Sync now" (a user gesture) to recover.
export function attemptBootReconnect(): void {
  if (!getActiveBackend().isConfigured()) {
    setSyncState({ status: 'offline', errorMessage: '' })
    return
  }

  // Fire-and-forget. runSync drives its own indicator states.
  void runSync()
}
