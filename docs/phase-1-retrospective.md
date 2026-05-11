# Phase 1 Retrospective

What we learned from building scaffolding + litter & kitten management, distilled for the next phase.

## Shipped

- Vite + React 19 + TypeScript 6 scaffold with strict tsconfig, PWA service worker, ESLint, Prettier
- Four core domains (`ids`, `litter`, `kitten`, `settings`) — 80 tests, full red-green TDD discipline
- Dexie persistence layer with v1 → v2 migration (backfilling `kitten.order`)
- Six routes (Home, LitterList, NewLitter, LitterDetail, Debug, NotFound) with React Router 7
- Reusable primitives (AppBar, Button, Input, ListItem) — dark-first, touch-target-min compliant
- Phone-tested on local network; two foster-mama feedback rounds incorporated

## Process Patterns That Worked

### Q&A before each chunk

Sub-phase kickoff questions (3–4, batched via `AskUserQuestion`) caught alignment issues before code:

- "Active litter" model (multi-active + optional sticky) — affected schema and routing
- Soft-delete semantics — affected schema and UX
- Navigation chrome — affected every screen
- Archived visibility — affected list shape
- Dexie reactive read pattern — affected ~20 components

Every one of these would have been a rewrite if discovered after coding. Continue this pattern in Phase 2.

### Red-then-green TDD for core, no tests for shell

Worked exactly as ADR-003 intended. The discipline of writing the failing test first forced contract clarity. Shell code stayed simple because it composed already-tested core functions. Zero test mocks needed across all 80 tests.

### Phone-test before push

Added mid-phase ("test before push" wind-down step). Caught the sticky-litter loading bug before it shipped. Adopt this universally.

### Inverted-pyramid per-folder CLAUDE.md

Each domain folder's `CLAUDE.md` was useful when picking up that domain after a context break. Lead with the contract; details below. The forcing function of "write the contract before the code" surfaced design questions early.

## Technical Surprises

### Strict TypeScript flags catch real bugs but require discipline

`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` (per tsconfig) caught silent bugs at compile time — e.g., array access returns `T | undefined`, optional props can't accept `undefined` values explicitly. These flags add friction but are net positive. Patterns to internalize:

- Use `array[i] ?? fallback` instead of `array[i]`
- Pass optional props conditionally (`{...(error && { error })}`) or always supply a default
- Treat `T | undefined` as "loading or absent" — handle it explicitly

### `useLiveQuery` returns `undefined` while loading

This caused the sticky-litter bug. `dexie-react-hooks` returns `undefined` on first render before the query resolves. Components that make routing decisions based on the query result **must** distinguish loading from absent, or they'll fire the wrong branch on first render and never recover (the navigation already happened).

See `src/shell/db/CLAUDE.md` for the canonical pattern.

### Null Object Pattern ≠ loading state

ADR-004 says use Null Objects for absent values. **But Null Objects are for absence in the data model, not for async-loading states.** Conflating the two caused the sticky bug — `useSettings()` returned `NullAppSettings` while loading, which has empty sticky id, which the consumer interpreted as "no sticky exists." Loading and absent are different concepts. ADR-004 has been refined to call this out.

### Dexie schema migrations are easier than I expected, but still need a migration

Adding `kitten.order` required a v2 migration with a backfill upgrade hook (~30 LOC). Dexie's `version().upgrade()` is clean. The discipline rule: **any field addition to a persisted entity gets a migration, even mid-development**. The cost is small; the cost of getting it wrong is data corruption.

### Boolean fields are unreliable as IndexedDB indexes

Originally indexed `active` and a `[litterId+active]` compound. Removed both — IndexedDB has flaky cross-browser boolean handling. At MVP scale (~10 kittens per litter) JS-side filtering after an indexed lookup is trivially fast.

## Design Lens Validation

"One-handed, in the dark, half-asleep" as the primary constraint was actively useful. Decisions that improved when run through this lens:

- Single combined create-litter form (rather than wizard) — one screen, no navigation under fatigue
- Soft-delete with show-archived toggle (rather than confirm-to-hard-delete) — no destructive prompts at 3 AM
- Pin-as-default in the create flow (rather than separate setting) — one tap to set up the next workflow
- MM-DD placeholder default rather than auto-filled value — preserves intentionality, doesn't pretend
- Up/down arrows for reorder rather than drag-and-drop — deterministic touch, no gesture ambiguity

## Carried Into Phase 2

- Continue per-folder CLAUDE.md before code
- Continue Q&A round at sub-phase start (Phase 2 should open with weight-entry UX questions)
- The wind-down skill (test-before-push) is correct as-is
- Weight entry is THE one-handed-dark-half-asleep stress test — this is where the primary design constraint either pays off or doesn't

## Carried Into Phase 5 (Polish)

- Wire `logo/logo.png` (and a 192×192 derivative) into the PWA manifest icons
- Favicon
- Verify install-to-homescreen on iOS and Android
