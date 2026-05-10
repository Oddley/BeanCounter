# src/shell/db/

Dexie persistence layer. Schema definitions, typed table access, live queries, and write helpers.

## Files

- `dexie.ts` — `BeanCounterDB` Dexie subclass; declares tables and version/migration plan; `populate` hook seeds the settings singleton on first open
- `queries.ts` — `useLiveQuery`-based reactive hooks for components to consume (`useLitters`, `useLitter`, `useKittens`, `useSettings`, etc.)
- `mutations.ts` — write helpers that compose core constructors with Dexie persistence (`persistNewLitter`, `archiveLitterById`, `setStickyLitterById`, etc.)
- `index.ts` — barrel exporting `db`, hooks, and mutations

## Schema (v1)

```ts
{
  litters:  'id'              // pk: id
  kittens:  'id, litterId'    // pk: id; index: litterId for "kittens in litter"
  settings: 'id'              // singleton: id always 'singleton'
}
```

`active` is not indexed — IndexedDB has flaky cross-browser behavior with boolean indexes. Active filtering happens in JS after the indexed `litterId` lookup. At ~5–10 kittens per litter the cost is trivial.

## Conventions

- Settings table holds exactly one record with `id: 'singleton'`. The `populate` hook inserts the empty default on first DB open.
- All mutation helpers compose pure core functions for entity construction; this file owns the side effect of writing.
- Reads use `useLiveQuery` so components re-render automatically when underlying data changes.
- No business logic here — branching on domain state goes to `core/`.

## Dependencies

- `dexie` — IndexedDB wrapper
- `dexie-react-hooks` — `useLiveQuery` reactive hook
- `src/core/litter`, `src/core/kitten`, `src/core/settings`, `src/core/ids`
