# src/core/ids/

ID generation utility. Wraps UUID v4 generation behind a thin domain boundary.

## Inputs

None. ID generation is parameterless.

## Outputs / Contract

- `newId(): string` — returns a freshly generated v4 UUID
- `isValidId(id: string): boolean` — true iff the input matches v4 UUID format

## Dependencies

- `uuid` (npm) for v4 generation

## Invariants

- `newId()` produces a different value on every call (probabilistically — UUID v4 collision is negligible)
- `newId()` output always matches v4 format: 8-4-4-4-12 hex with version nibble `4` and variant nibble in `[89ab]`
- `isValidId('')` returns `false`
- `isValidId(newId())` returns `true`
- Other UUID versions (v1, v3, v5) return `false` from `isValidId` — only v4 is accepted

## Why a wrapper?

A thin domain boundary lets the rest of `core/` import a single named function (`newId`) instead of `uuidv4`. If we ever swap the underlying implementation (e.g., crypto.randomUUID once core targets browsers only), one file changes, not every consumer.
