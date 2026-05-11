# ADR-004: Nothing is Something (Null Object Pattern)

**Status:** Accepted

**Based on:** Sandi Metz, "Nothing is Something" (RailsConf 2015) — https://www.youtube.com/watch?v=29MAL8pJImQ

**Decision:** Absence is represented by typed Null Objects, not by null/undefined checks. Conditionals gating on presence/absence are a code smell in core. Every domain entity that can be absent has a Null Object that is fully substitutable for it.

## Rules

- Every domain type that can be absent gets a corresponding Null Object implementing its interface
- Null Objects respond to all messages with safe, neutral behavior (zero, empty string, empty array, no-op, false)
- Conditional logic gating on `null | undefined` is replaced with polymorphism — the caller does not need to know which variant it holds
- `?.` optional chaining and `?? fallback` are acceptable **at the shell boundary only** (I/O, Dexie reads, API responses) — not inside `src/core/`
- Core functions return Null Objects, never `null`, `undefined`, or thrown exceptions for expected absent states

## Pattern

```typescript
// types.ts
interface Kitten {
  readonly id: string
  readonly displayName: string
  readonly isActive: boolean
  readonly litterId: string
}

const NullKitten: Kitten = {
  id: '',
  displayName: 'Unknown',
  isActive: false,
  litterId: '',
}

// Usage in core — no null check needed
function formatKittenLabel(kitten: Kitten): string {
  return `${kitten.displayName} (${kitten.litterId})`
  // NullKitten produces "Unknown ()" — safe, no guard required
}
```

## Why

Null checks scattered through core create hidden conditional branches that are hard to test and easy to miss. A Null Object makes absence explicit, testable, and composable — it passes through function pipelines without requiring guards at each step. This aligns with SOLID (L: substitutability) and FC/IS (core stays branch-free).

## Anti-patterns

```typescript
// ❌ conditional on absence in core
if (kitten) {
  return kitten.displayName
} else {
  return 'Unknown'
}

// ✅ NullKitten.displayName is already 'Unknown'
return kitten.displayName
```

- Returning `null` or `undefined` from core functions for expected absent states
- `throw` on absence inside core (let the shell decide how to handle truly unexpected states)
- Optional properties (`kitten?: Kitten`) on core function signatures — use the Null Object instead
- Overloaded signatures that return `T | null` — return `T` where `NullT` is a valid `T`

## Null Object ≠ Loading State

**Null Objects represent absence in the data model. They do NOT represent async-loading or "not-yet-fetched" states.** Conflating the two causes silent bugs: a consumer reads `NullX` and proceeds as if the answer is "no X exists" when the real answer is "X is still loading."

### Pattern: Loading-aware shell hooks

When a shell hook wraps an async query (e.g., `useLiveQuery` from `dexie-react-hooks`), return `undefined` while the query is pending, and the typed result (which may be a Null Object) once it resolves:

```typescript
// ❌ conflates loading with absent — caller can't tell which is which
export function useSettings(): AppSettings {
  const record = useLiveQuery(() => db.settings.get('singleton'))
  return record ?? NullAppSettings  // BUG: NullAppSettings on first render
}

// ✅ caller can distinguish
export function useSettings(): AppSettings | undefined {
  return useLiveQuery(() => db.settings.get('singleton'))
}

// caller renders nothing while loading, decides once loaded
function Home() {
  const settings = useSettings()
  if (settings === undefined) return null
  if (hasStickyLitter(settings)) return <Navigate to={...} />
  return <Navigate to="/litters" />
}
```

**Rule:** Null Object fallback is fine for hooks whose consumers don't care about the loading distinction (e.g., display-only consumers). For hooks whose consumers make routing or write decisions, return `T | undefined` and handle the loading branch explicitly.

This is a shell-layer concern. Core remains pure — core functions accept and return Null Objects freely; they never see "loading" because core has no async.
