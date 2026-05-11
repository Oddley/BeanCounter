# src/core/kitten/

Kitten domain: pure types and transformations for an individual kitten within a litter.

## Inputs

- IDs (string) generated upstream via `core/ids`
- Display names (string) provided by the user
- `litterId` foreign key linking each kitten to its parent litter

## Outputs / Contract

- `Kitten` interface — `{ id, displayName, active, litterId, order }`
- `NullKitten` — Null Object substitutable wherever `Kitten` is expected (ADR-004)
- `createKitten({ id, litterId, displayName, order }) → Kitten` — produces a fresh active Kitten at the given order
- `archiveKitten(Kitten) → Kitten` — soft-delete; idempotent
- `activateKitten(Kitten) → Kitten` — un-archives; idempotent
- `renameKitten(Kitten, newDisplayName) → Kitten` — replaces display name; trims
- `validateKittenName(name) → { valid, errors[] }` — pure validation
- `defaultKittenName(index) → string` — produces "Kitten 1", "Kitten 2", …
- `reassignOrders(orderedKittens[]) → Kitten[]` — given an array in desired order, returns new array with sequential `order` values 0..n-1
- `moveKittenUp(kittens[], index) → Kitten[]` — swap with previous, reassign orders; out-of-bounds is a no-op (returns shallow copy)
- `moveKittenDown(kittens[], index) → Kitten[]` — swap with next, reassign orders; out-of-bounds is a no-op

## Dependencies

None at runtime. UUID generation happens upstream in shell.

## Invariants

- All transformations return new `Kitten` objects (immutable input)
- Display names are stored trimmed
- `active` is the single source of truth for soft-delete state
- `litterId` is set at creation and never changes via these functions (a kitten cannot move between litters in MVP)
- `defaultKittenName(1)` returns `"Kitten 1"` (1-indexed for human friendliness)
- `order` is a 0-indexed integer assigned by the caller; ordering semantics live in the caller (typically `shell/db`). After `reassignOrders`, the returned array has orders 0..n-1 matching array index. Within an active group, smaller order renders first.
