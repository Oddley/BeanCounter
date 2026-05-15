# src/shell/pwa/

Service-worker registration + lifecycle visibility for the UI.

## Files

- `register.ts` — wraps vite-plugin-pwa's `registerSW` once at boot. Subscribes to lifecycle events and pushes them into the PwaStatus singleton. Also polls `registration.update()` every 60s to keep `lastCheckedAt` honest.
- `state.ts` — module-level `PwaStatus` + `usePwaStatus()` hook (mirrors the `shell/sync/state.ts` pattern).
- `index.ts` — barrel.

## Outputs / Contract

- `installPwaRegistration()` — called once at App mount. Idempotent.
- `applyPendingUpdate()` — user-gesture handler for the "Reload to update" button. Activates the waiting SW and reloads the page.
- `usePwaStatus() → PwaStatus` — subscribe to lifecycle state for UI.

## State Shape

| Field | Meaning |
|---|---|
| `registeredAt` | ms epoch when SW first registered this session |
| `lastCheckedAt` | ms epoch of last update check (registration or poll) |
| `needsRefresh` | true when a newer SW is downloaded and ready to take over on reload |
| `offlineReady` | true after the SW has precached enough to serve the app offline |
| `registrationError` | error message string if SW registration failed, else null |

## Boot Flow

1. `App.tsx` calls `installPwaRegistration()` in a top-level `useEffect`
2. `vite-plugin-pwa` registers the SW + downloads `sw.js`
3. `onRegisteredSW` fires → state.registeredAt + state.lastCheckedAt set
4. Periodic poll calls `registration.update()` every 60s; each successful check bumps `lastCheckedAt`
5. When a newer SW is found and downloaded → `onNeedRefresh` fires → state.needsRefresh = true
6. User taps Reload in Settings → `applyPendingUpdate()` → SW activates + page reloads
