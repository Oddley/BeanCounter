# src/core/sync/

Pure per-entity last-write-wins merge logic for reconciling local Dexie state with the remote `active.json`. No I/O, no React, no Drive API — just the merge math. Orchestration (when to merge, where the inputs come from, where the outputs go) lives in `shell/sync/`.

## Outputs / Contract

- `SyncableEntity` interface — `{ id, lastUpdatedAt }` constraint for merge candidates
- `MergeConflict<T>` — `{ id, local, remote }` signals a tie-with-different-content
- `MergeResult<T>` — `{ merged, conflicts }` for entity arrays
- `SettingsMergeResult` — singleton-merge result for `AppSettings`
- `SnapshotMergeResult` — end-to-end across all entity types
- `mergeEntities(local[], remote[], equals?) → MergeResult<T>` — generic per-entity merge
- `mergeSettings(local, remote) → SettingsMergeResult` — singleton merge
- `mergeSnapshots(local, remote) → SnapshotMergeResult` — merges all entity types from two `ActiveFileSnapshot`s
- `deepEqual(a, b) → boolean` — structural equality used as the default `equals` for content comparison

## Merge Rules (per ADR-007)

| Side has entity E? | Action |
|---|---|
| Only local has E | Keep local |
| Only remote has E | Take remote |
| Both, `local.lastUpdatedAt > remote.lastUpdatedAt` | Keep local |
| Both, `remote.lastUpdatedAt > local.lastUpdatedAt` | Take remote |
| Both, equal `lastUpdatedAt`, identical content | No-op (use either) |
| Both, equal `lastUpdatedAt`, different content | **Conflict** — local wins in `merged`; conflict reported separately |

Tie-with-different-content picks the local value for the merged output and reports the conflict for UI surfacing. The "local wins" tie-break is arbitrary but deterministic; consumers that want the opposite can swap arguments.

## Dependencies

- `core/litter`, `core/kitten`, `core/session`, `core/weight`, `core/settings` — for entity types
- `core/active-file` — for `ActiveFileSnapshot` shape

## Invariants

- All functions are pure: same inputs → same outputs, no side effects
- The merged output preserves the original entities' identity (no mutation, no cloning beyond what's needed)
- `mergeEntities` is commutative in keys but the conflict tie-break prefers the first argument (local)
- `deepEqual` handles primitives, arrays, and plain objects; sufficient for our entity shapes (no Date, no Map, no functions)
