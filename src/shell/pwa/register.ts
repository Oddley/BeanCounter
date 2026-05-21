import { registerSW } from 'virtual:pwa-register'
import { setPwaStatus } from './state'

// Wraps vite-plugin-pwa's registerSW once at app boot. Pushes lifecycle
// events into the PwaStatus singleton so Settings can show "up to date"
// / "update available" UX.

const UPDATE_CHECK_INTERVAL_MS = 60_000

let installed = false
let pollInterval: ReturnType<typeof setInterval> | null = null

export function installPwaRegistration(): void {
  if (installed) return
  installed = true

  // registerSW returns an updateServiceWorker function we used to call
  // from applyPendingUpdate. We no longer use it (the unregister-and-
  // reload path is more reliable), but we still need to invoke
  // registerSW for its side effect of wiring the onNeedRefresh /
  // onRegisteredSW / etc. callbacks that drive the indicator.
  registerSW({
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

// User-gesture trigger for the "Reload to update" button in Settings.
//
// We *don't* go through vite-plugin-pwa's updateServiceWorker /
// skipWaiting handshake. That handshake can silently fail when the
// waiting SW is already in a transitional state (or when the
// 'controlling' event listener races with the click), leaving the user
// tapping a button that does nothing.
//
// Instead: unregister every service worker for this origin, then
// reload. The reloaded page fetches fresh assets from the CDN and
// registers a brand-new SW with the latest code. Slower than the
// skipWaiting path (one extra network round-trip's worth of un-
// caching), but guaranteed to actually give the user the new version.
//
// The fire-and-forget shape means the click handler doesn't need to
// await — the function navigates the page away as a side effect.
export function applyPendingUpdate(): void {
  void (async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registrations =
          await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map((r) => r.unregister()))
      } catch {
        // SW unregister failures are non-fatal — just proceed to reload.
        // The new version may still come through on a fresh fetch.
      }
    }
    window.location.reload()
  })()
}
