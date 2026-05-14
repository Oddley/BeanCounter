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
