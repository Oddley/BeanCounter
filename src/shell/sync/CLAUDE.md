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

## Sync triggers

1. **Boot** — `attemptBootReconnect` from `App.tsx` mount.
2. **Navigation** — `SyncOnNavLayout` in `App.tsx` watches `location.pathname`; if `isDirty()` && `hasStoredConnection()`, fires silent `runSync()`.
3. **Manual Sync now** — Settings button; passes `allowInteractive: true` so an OAuth popup can run from a user-gesture context.

There is **no** debounce timer, no foreground-return pull, no service-worker background sync. The model is "every navigation is a save point."

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
