# ADR-002: SOLID + Functional Core / Imperative Shell

**Status:** Accepted

**Decision:** Business logic lives in pure TypeScript functions (`src/core/`). React components, hooks, and I/O live in the shell (`src/shell/`). SOLID governs both layers. The shell is a strict sequence of linear steps with no branching domain logic.

## Functional Core (`src/core/`)

- Pure functions only: same input → same output, no side effects
- No I/O, no async, no React imports
- All domain types, interfaces, transformations, and Null Objects live here
- Fully testable with Vitest — no mocks needed (pure functions have no dependencies to mock)
- The shell calls core; core never calls shell

## Imperative Shell (`src/shell/`)

- React components, hooks, event handlers, Dexie reads/writes, Google Sheets API calls
- Linear sequences of steps — no branching on domain state
- Not unit-tested; correctness verified through integration or manual testing
- Contains no business logic; delegates all decisions to core functions

## SOLID in Practice

| Principle | Application |
|---|---|
| **Single Responsibility** | Each core module has one reason to change; each shell component has one job |
| **Open/Closed** | Extend behavior via new functions/types; do not modify existing core logic |
| **Liskov Substitution** | Null Objects (see ADR-004) are fully substitutable for their base types |
| **Interface Segregation** | Interfaces are scoped to the consuming context, not "god interfaces" |
| **Dependency Inversion** | Core depends on TypeScript interfaces; shell wires in concrete implementations |

## Directory Contract

```
src/
  core/
    [domain]/         ← one folder per bounded domain concept
      index.ts        ← public API of this domain
      [domain].ts     ← pure functions
      [domain].test.ts
      types.ts        ← interfaces and Null Objects for this domain
      CLAUDE.md       ← contract: inputs, outputs, invariants, dependencies
  shell/
    [feature]/        ← one folder per user-facing feature
      index.tsx       ← entry point component
      [feature].tsx
      CLAUDE.md       ← entry points, side effects, shell dependencies
```

## Anti-patterns

- Business logic inside React components or hooks — belongs in core
- Async code in core — belongs in shell
- Shared mutable state in core — core is stateless
- Shell functions that branch on domain state — extract the condition to a core function
- Core functions that import from shell — this direction is forbidden
