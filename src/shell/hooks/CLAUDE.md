# src/shell/hooks/

Reusable React hooks for the shell layer.

## Hooks

| Hook | Purpose |
|---|---|
| `useAutosave` | Debounced async save. Caller passes a value and a save function; hook fires the save on each change after a delay, cancelling pending saves if the value changes again before the delay elapses. |

## Conventions

- Hooks here may have side effects (the whole point); they call into `shell/db` or other shell modules
- Hooks do not contain business logic — they orchestrate timing/effects around pure core decisions
- No tests per ADR-003 — verified through integration / phone testing
