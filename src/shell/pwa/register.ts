import { registerSW } from 'virtual:pwa-register'
import { setPwaStatus } from './state'

// Wraps vite-plugin-pwa's registerSW once at app boot. Pushes lifecycle
// events into the PwaStatus singleton so Settings can show "up to date"
// / "update available" UX.

const UPDATE_CHECK_INTERVAL_MS = 60_000

let updateTrigger: ((reloadPage?: boolean) => Promise<void>) | null = null
let installed = false
let pollInterval: ReturnType<typeof setInterval> | null = null

export function installPwaRegistration(): void {
  if (installed) return
  installed = true

  updateTrigger = registerSW({
    onNeedRefresh() {
      setPwaStatus({ needsRefresh: true })
    },
    onOfflineReady() {
      setPwaStatus({ offlineReady: true })
    },
    onRegisteredSW(_swUrl, registration) {
      const now = Date.now()
      setPwaStatus({ registeredAt: now, lastCheckedAt: now })
      if (registration && pollInterval === null) {
        pollInterval = setInterval(() => {
          void registration
            .update()
            .then(() => {
              setPwaStatus({ lastCheckedAt: Date.now() })
            })
            .catch(() => {
              // Network failures during update checks are non-fatal —
              // the SW will retry on its own next time. We don't surface
              // these as errors because they're routine offline blips.
            })
        }, UPDATE_CHECK_INTERVAL_MS)
      }
    },
    onRegisterError(error) {
      setPwaStatus({
        registrationError:
          error instanceof Error ? error.message : String(error),
      })
    },
  })
}

// User-gesture trigger: activate the waiting SW and reload the page.
// Safe to call when no update is pending — falls back to plain reload.
export function applyPendingUpdate(): void {
  if (updateTrigger !== null) {
    void updateTrigger(true)
  } else {
    window.location.reload()
  }
}
