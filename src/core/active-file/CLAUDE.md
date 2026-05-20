# src/core/active-file/

Serialization for the Drive `active.json` file — the JSON shape we read and write.

## Outputs / Contract

- `ActiveFile` interface — full shape of `active.json` content
- `CURRENT_SCHEMA_VERSION` — `1` for Phase 4b; bumped on file-format-breaking changes
- `snapshotToJson(snapshot) → string` — pure; serializes local state to a JSON string with `schemaVersion` embedded
- `parseActiveFile(text) → ParseResult` — pure; returns `{ ok: true, file }` or `{ ok: false, error }`

## Schema Version Behavior

`parseActiveFile` checks `schemaVersion`:
- equal to `CURRENT_SCHEMA_VERSION` → accept
- greater → reject ("file is from a newer app version"; refuse to overwrite)
- less → reject ("legacy format"; no upgrade path in Phase 4 per pre-1.0 status)

The forward-compat refusal is the load-bearing one — it stops a device running an older app from clobbering a newer device's file.

## Dependencies

- `core/litter`, `core/kitten`, `core/session`, `core/weight`, `core/settings` — for entity types only

## Invariants

- `snapshotToJson(s)` produces valid JSON for any well-formed snapshot
- `parseActiveFile(snapshotToJson(s))` round-trips when `s` matches `ActiveFile` shape
- All array fields are non-null in the parsed result (empty arrays preferred over missing)
- **Every parsed entity is normalized to the current type shape** — fields missing in the on-disk JSON are filled in from `NullX` defaults. This is load-bearing for sync correctness: the merge's tie-break uses `deepEqual` on entity content, and a missing-field local-vs-remote difference would otherwise look like a conflict to the merge.

## Schema-evolution convention — IMPORTANT

When adding a field to a synced entity (Litter / Kitten / FeedingSession / WeightEntry / AppSettings):

1. **Add the field to the type** with `readonly`
2. **Add a default value to the corresponding `NullX`** in the same `types.ts`
3. **Add a Dexie migration** that backfills the field on existing local rows
4. (You do NOT need to update `parse.ts` — the spread-from-NullX pattern automatically picks up the new default)

Skipping step 2 reintroduces the schema-evolution footgun: existing on-disk JSON lacks the new field, the parser would return entities missing the field, and merge equality checks would flag every entity as conflicted on the next sync. **The 66-conflict incident that prompted this convention.**

If you're tempted to add a field without a default, ask whether the field is truly required or whether `undefined` / sentinel value is meaningful at the data-model level. If yes, document the meaning. If no, give it a default.
