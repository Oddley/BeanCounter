# src/shell/sync/

Sync state machine + (later) sync orchestration logic.

## Phase 4a scope (this directory currently)

- `state.ts` — module-level sync state with `useSyncState` hook for components. Mutator `setSyncState` is called by auth + sync code to drive the indicator.

## Phase 4d scope (coming)

- `orchestrator.ts` — debounce, foreground-pull, finish-tap immediate, service-worker push-while-pending wiring
- `merge-runner.ts` — drives `core/sync.merge` from local Dexie state + remote `active.json`

## State Machine

| Status | Meaning |
|---|---|
| `unconnected` | No Drive connection (default; pre-Connect, post-revoke) |
| `pending` | Local edits awaiting push, OR last remote check >10min ago, OR sync in progress |
| `synced` | No pending changes; remote checked within last 10 min |
| `error` | Sync failed (auth, network, conflict); requires user attention |

Per ADR-007. The four states map 1:1 to the AppBar indicator.

## Dependencies

- `shell/auth` for token state queries (Phase 4d)
- React (for the `useSyncState` hook only — pure state otherwise)
