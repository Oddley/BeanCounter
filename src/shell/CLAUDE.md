# src/shell/

Imperative shell. React components, Dexie persistence, PWA, side effects.

## Contract

- Linear sequences of steps; no branching domain logic (extract conditions to `core/`)
- May import freely from `core/` and other `shell/` modules
- Not unit-tested per ADR-003 — verified through integration or manual phone testing
- All async, all I/O, all browser API usage lives here

## Subfolders

| Folder | Purpose |
|---|---|
| `app/` | App entry: `main.tsx`, `App.tsx`, router, theme provider |
| `db/` | Dexie schema, tables, migrations, queries |
| `routes/` | Per-route components (one file per route) |
| `components/` | Reusable UI primitives |
| `hooks/` | Reusable React hooks |
| `pwa/` | Service worker registration, install prompt, offline UX |

(Folders are added as phases require them — not all exist at every phase.)

## Patterns

- React function components only (no classes)
- Hooks: prefer `useEffect` only for true side effects, not derived state
- State precedence: Dexie (persistent) → React Context (cross-cutting) → `useState` (ephemeral)
- No external state management library
