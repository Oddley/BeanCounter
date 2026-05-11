# src/shell/db/

Dexie persistence layer. Schema definitions, typed table access, live queries, and write helpers.

## Files

- `dexie.ts` — `BeanCounterDB` Dexie subclass; declares tables and version/migration plan; `populate` hook seeds the settings singleton on first open
- `queries.ts` — `useLiveQuery`-based reactive hooks for components to consume (`useLitters`, `useLitter`, `useKittens`, `useSettings`, etc.)
- `mutations.ts` — write helpers that compose core constructors with Dexie persistence (`persistNewLitter`, `archiveLitterById`, `setStickyLitterById`, etc.)
- `index.ts` — barrel exporting `db`, hooks, and mutations

## Schema

```ts
{
  litters:  'id'              // pk: id
  kittens:  'id, litterId'    // pk: id; index: litterId for "kittens in litter"
  settings: 'id'              // singleton: id always 'singleton'
}
```

Indexed stores have not changed between v1 and v2. `active` is not indexed — IndexedDB has flaky cross-browser behavior with boolean indexes. Active filtering happens in JS after the indexed `litterId` lookup. At ~5–10 kittens per litter the cost is trivial. `order` is also not indexed; sort happens in JS post-fetch.

## Migrations

- **v1 → v2**: Backfill `order: number` on every existing kitten record. For each litter, kittens are sorted by id (stable, deterministic) and assigned sequential orders 0..n-1. Migration is idempotent and side-effect-free on already-v2 data.

## Conventions

- Settings table holds exactly one record with `id: 'singleton'`. The `populate` hook inserts the empty default on first DB open.
- All mutation helpers compose pure core functions for entity construction; this file owns the side effect of writing.
- Reads use `useLiveQuery` so components re-render automatically when underlying data changes.
- No business logic here — branching on domain state goes to `core/`.

## Loading state — read this before adding a new `use*` hook

`useLiveQuery` returns `undefined` while the underlying query is pending. **All `use*` hooks in this file return `T | undefined`** (where `T` may be a domain type or array of domain types) to let callers distinguish loading from absent.

This is deliberate per ADR-004. Falling back to a Null Object inside a hook conflates async loading with data-model absence, and the symptom — components making the wrong decision on first render before the query resolves — is the sticky-litter bug we already shipped and reverted.

Caller pattern:

```tsx
function MyRoute() {
  const settings = useSettings()
  if (settings === undefined) return null  // or a skeleton
  // settings is AppSettings here
  if (hasStickyLitter(settings)) { ... }
}
```

For consumers that genuinely don't care about loading (display-only, where rendering with the Null Object would be visually fine), use `?? NullX` at the consumer site, not inside the hook.

## Dependencies

- `dexie` — IndexedDB wrapper
- `dexie-react-hooks` — `useLiveQuery` reactive hook
- `src/core/litter`, `src/core/kitten`, `src/core/settings`, `src/core/ids`
