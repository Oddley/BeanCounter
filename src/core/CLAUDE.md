# src/core/

Pure business logic. No I/O, no React, no async, no side effects.

## Contract

Every exported function:
- Is pure: same input → same output, no side effects
- Is fully tested via Vitest (ADR-003)
- Returns Null Objects, never `null` or `undefined`, for absent values (ADR-004)
- Imports only from other `core/` modules or pure npm libraries

## Domains

One folder per bounded domain concept. Each domain folder contains:
- `CLAUDE.md` — contract for this domain
- `types.ts` — interfaces, type definitions, Null Objects
- `<domain>.ts` — pure functions
- `<domain>.test.ts` — Vitest tests
- `index.ts` — public API barrel

## Forbidden Imports

- `react`, `react-dom`, `react-router-dom`
- `dexie`
- `node:*` (no Node.js APIs)
- Browser globals (`window`, `document`, `localStorage`, `crypto`, `fetch`)
- Anything from `src/shell/`

If core code needs randomness, time, or IDs, it receives them as function parameters (dependency inversion per ADR-002).
