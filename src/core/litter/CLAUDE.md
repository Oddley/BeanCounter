# src/core/litter/

Litter domain: pure types and transformations for a foster placement of kittens.

## Inputs

- IDs (string) generated upstream via `core/ids`
- Names (string) provided by the user
- `now` (millis since epoch) supplied by the shell at mutation time — bumps `lastUpdatedAt`
- Existing Litter values for state transitions

## Outputs / Contract

- `Litter` interface — `{ id, name, active, lastUpdatedAt }`
- `NullLitter` — Null Object substitutable wherever `Litter` is expected (ADR-004)
- `createLitter({ id, name, now }) → Litter` — fresh active Litter; `lastUpdatedAt = now`
- `archiveLitter(Litter, now) → Litter` — soft-delete; bumps `lastUpdatedAt`
- `activateLitter(Litter, now) → Litter` — un-archives; bumps `lastUpdatedAt`
- `renameLitter(Litter, newName, now) → Litter` — replaces name; trims; bumps `lastUpdatedAt`
- `validateLitterName(name) → { valid, errors[] }` — pure validation

## Dependencies

None at runtime. UUID generation and the current timestamp happen upstream in the shell — core receives both as parameters (dependency inversion per ADR-002).

## Invariants

- All transformations return new `Litter` objects (immutable input)
- Names are stored trimmed (leading/trailing whitespace removed)
- `active` is the single source of truth for soft-delete state
- Every mutator bumps `lastUpdatedAt` even when the operation is idempotent at the value level — sync needs to know "this entity was touched at time T"
- `NullLitter.lastUpdatedAt === 0` — treated as "older than any real write" by the per-entity LWW merge (ADR-007)
- `NullLitter.active` is `false` (calling `archiveLitter` on the absent case is safe)

## Why id and now passed in?

Core is pure. UUID generation and `Date.now()` are non-deterministic side effects. Passing them in keeps these functions testable without mocks (ADR-003).

## Removed fields

- `sheetTabId` — obsolete with Drive sync (ADR-007). Phase 4b dropped it from the type.
