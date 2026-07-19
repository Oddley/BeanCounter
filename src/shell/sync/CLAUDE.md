# src/shell/sync/

Sync state machine + orchestration. Explicit-save model: navigation
events trigger a silent sync when local has unpublished changes; no
background debounce timer.

## Files

- `state.ts` — module-level sync state with `useSyncState` hook for components. Mutator `setSyncState` is called by auth + sync code to drive the AppBar indicator. `markStateDirtyIfSynced` flips Synced → Dirty when a local edit lands.
- `dirty.ts` — pure flag tracking "local has unpushed changes." No timer. `markDirty` is called from every Dexie mutation; `clearDirty` runs after a successful sync. `setSuspended(true)` around the orchestrator's apply-merged-to-local writes so they don't re-mark dirty.
- `first-connect.ts` — first-connect orchestration: `inspectDrive`, `snapshotLocal`, `pushLocalToActive`, `pullActiveToLocal`, `hasAnyLocalData`.
- `orchestrator.ts` — `runSync({ allowInteractive? })`: singleton-in-flight inspect → merge → apply-to-local → push. Mid-sync edits detected via `getDirtySince()` delta and land in `'dirty'` rather than `'synced'`.
- `boot.ts` — `attemptBootReconnect`: on app start, fires one silent `runSync` if a stored connection exists. No interactive popup at boot (browsers block it without a user gesture).
- `actions.ts` — `triggerManualSync()`: the one function any user-tap sync control should call. Fires `wakeSidecarIfNeeded()` synchronously (no `await` before it) then `runSync({ allowInteractive: true })`.
- `sidecar.ts` — Android sidecar HTTP client. `isSidecarAvailable()` caches its last result; `wakeSidecarIfNeeded()` reads that cache synchronously so a click handler can decide to fire the `beancounter-sync://` wake intent without first awaiting a ping (which would burn the click's gesture credit — see below).

## Sync triggers

1. **Boot** — `attemptBootReconnect` from `App.tsx` mount. Silent only: never fires the sidecar wake intent (no gesture to spend it on). Uses the sidecar only if it's already running.
2. **Navigation** — `SyncOnNavLayout` in `App.tsx` watches `location.pathname`; if `isDirty()` && `hasStoredConnection()`, fires silent `runSync()`. Same sidecar-wake restriction as boot.
3. **Manual Sync** — `AppBar`'s `SyncButton` (every screen) and the Settings "Sync now" button both call `triggerManualSync()`; passes `allowInteractive: true` so an OAuth popup — or a sidecar wake without Chrome's "Open in app?" interstitial — can run from a genuine user-gesture context.

There is **no** debounce timer, no foreground-return pull, no service-worker background sync. The model is "every navigation is a save point," plus one explicit tap to force it.

### Why the sidecar wake is gesture-gated

Chrome only skips its "Continue to [app]?" confirmation when a `beancounter-sync://`
launch is directly gesture-initiated. Boot and nav-triggered syncs have no
gesture at all, and even a real button click loses its gesture credit if
`tryWakeSidecar()` fires after an `await` (e.g. a ping's `setTimeout`). So:
wake attempts are restricted to `allowInteractive` runs, and the actual
`tryWakeSidecar()` call happens synchronously in `triggerManualSync()` /
`wakeSidecarIfNeeded()` before any async work — see [android/CLAUDE.md](../../../android/CLAUDE.md) for the service side of this (idle-timeout self-stop, `WakeActivity` task-affinity fix).

## State Machine

Five states, in precedence order (higher wins when multiple apply):

| Status | Meaning |
|---|---|
| `offline` | No Drive connection (default; pre-Connect, post-disconnect) |
| `syncing` | A `runSync` is in flight right now |
| `error` | Last sync attempt failed; local has changes that didn't reach Drive |
| `dirty` | Local has unpushed edits; no sync attempted yet since the last green |
| `synced` | Local matches Drive |

Per ADR-007 (updated post-Phase-4-pivot). The five states map 1:1 to the AppBar indicator.

## Dependencies

- `shell/auth` for token + stored-connection state
- React (for the `useSyncState` hook only — pure state otherwise)
