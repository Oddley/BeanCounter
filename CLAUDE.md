# Bean Counter — Project Context

Local-first PWA: foster caregivers log kitten weights during feeding sessions.
**Primary constraint: one-handed, dark-room, half-asleep operation. Every UX and API decision defers to this.**

Google Sheets is the sync backend, not the primary DB. All interactions work offline first.

## Standards (read before writing any code)

| Concern | ADR |
|---|---|
| Tech stack | [ADR-001](docs/adr/001-tech-stack.md) |
| Architecture (SOLID + FC/IS) | [ADR-002](docs/adr/002-architecture.md) |
| Testing (Red-Green TDD) | [ADR-003](docs/adr/003-tdd.md) |
| Null handling (Nothing is Something) | [ADR-004](docs/adr/004-nothing-is-something.md) |
| Documentation | [ADR-005](docs/adr/005-documentation.md) |
| Git workflow | [ADR-006](docs/adr/006-git-workflow.md) |

## Directory Map

```
src/
  core/           ← pure business logic; fully tested; no I/O
    [domain]/
      CLAUDE.md   ← domain contract: inputs, outputs, invariants
  shell/          ← React components, hooks, Dexie, API calls
    [feature]/
      CLAUDE.md   ← feature entry points and side effects
docs/
  adr/            ← one file per architectural decision
```

## Key Invariants (these override everything else)

1. Core functions are pure and tested. Shell functions are linear side-effect sequences, not tested.
2. Absence is always represented by a typed Null Object — never by a null/undefined check in core.
3. Red before green — no feature code in core without a failing test first.
4. If it needs a comment, it needs a better name instead.
5. The primary user is one-handed, in the dark, half-asleep. Optimize ruthlessly for this.
