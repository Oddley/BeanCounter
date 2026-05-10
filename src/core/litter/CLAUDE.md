# src/core/litter/

Litter domain: pure types and transformations for a foster placement of kittens.

## Inputs

- IDs (string) generated upstream via `core/ids`
- Names (string) provided by the user
- Existing Litter values for state transitions

## Outputs / Contract

- `Litter` interface — `{ id, name, active, sheetTabId }`
- `NullLitter` — Null Object substitutable wherever `Litter` is expected (ADR-004)
- `createLitter({ id, name }) → Litter` — produces a fresh active Litter
- `archiveLitter(Litter) → Litter` — soft-delete (sets active=false); idempotent
- `activateLitter(Litter) → Litter` — un-archives (sets active=true); idempotent
- `renameLitter(Litter, newName) → Litter` — replaces name; trims whitespace
- `validateLitterName(name) → { valid, errors[] }` — pure validation

## Dependencies

None at runtime. UUID generation happens upstream in shell — core receives the id as a parameter (dependency inversion per ADR-002).

## Invariants

- All transformations return new `Litter` objects (immutable input)
- Names are stored trimmed (leading/trailing whitespace removed)
- `active` is the single source of truth for soft-delete state (ADR plan)
- `sheetTabId` defaults to empty string until Phase 4 sync assigns one
- `NullLitter.active` is `false` (calling `archiveLitter` on the absent case is safe)

## Why id passed in?

Core is pure; UUID generation is non-deterministic. Passing id in keeps `createLitter` testable without mocks (ADR-003).
