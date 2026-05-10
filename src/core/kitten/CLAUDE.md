# src/core/kitten/

Kitten domain: pure types and transformations for an individual kitten within a litter.

## Inputs

- IDs (string) generated upstream via `core/ids`
- Display names (string) provided by the user
- `litterId` foreign key linking each kitten to its parent litter

## Outputs / Contract

- `Kitten` interface — `{ id, displayName, active, litterId }`
- `NullKitten` — Null Object substitutable wherever `Kitten` is expected (ADR-004)
- `createKitten({ id, litterId, displayName }) → Kitten` — produces a fresh active Kitten
- `archiveKitten(Kitten) → Kitten` — soft-delete; idempotent
- `activateKitten(Kitten) → Kitten` — un-archives; idempotent
- `renameKitten(Kitten, newDisplayName) → Kitten` — replaces display name; trims
- `validateKittenName(name) → { valid, errors[] }` — pure validation
- `defaultKittenName(index) → string` — produces "Kitten 1", "Kitten 2", …

## Dependencies

None at runtime. UUID generation happens upstream in shell.

## Invariants

- All transformations return new `Kitten` objects (immutable input)
- Display names are stored trimmed
- `active` is the single source of truth for soft-delete state
- `litterId` is set at creation and never changes via these functions (a kitten cannot move between litters in MVP)
- `defaultKittenName(1)` returns `"Kitten 1"` (1-indexed for human friendliness)
