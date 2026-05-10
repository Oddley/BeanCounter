# src/

Application source. Two top-level layers per ADR-002:

| Layer | Purpose | Tested? |
|---|---|---|
| `core/` | Pure business logic, domain types, Null Objects | Yes — all exported functions |
| `shell/` | React, Dexie, I/O, PWA, side effects | No — verified via integration / manual |
| `styles/` | Global CSS + theme variables | N/A |

## Dependency Rules

- `core/` may import only from other `core/` modules and standard TypeScript / npm pure libraries
- `shell/` may import from `core/` and other `shell/` modules
- **Core never imports from shell** — this direction is forbidden by ADR-002

## File Conventions

- TypeScript only (no `.js`)
- Tests collocated: `foo.ts` → `foo.test.ts`
- One concept per file; one folder per bounded domain
- Every directory has a `CLAUDE.md` describing its contract (ADR-005)
