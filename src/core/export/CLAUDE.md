# src/core/export/

CSV export for kitten weight data. Produces a two-section spreadsheet (grams then ounces) from raw session/entry/kitten data.

## Outputs / Contract

- `buildCsv(input: BuildCsvInput) → string` — builds a UTF-8 CSV string
  - Column 1 header: `Grams`; remaining columns: one per session, formatted as human-readable local date/time
  - One kitten row per kitten (sorted by `order`), weights in grams; empty cell when no entry exists
  - A blank separator row between the grams and ounces sections
  - Column 1 header: `Ounces`; same session columns; weights converted at 1g = 0.035274oz, 2 decimal places
  - Sessions sorted chronologically by `effectiveTime` (`recordedAt` if > 0, else `createdAt`)
  - Kitten names and session headers are CSV-escaped (double-quote wrap if they contain `,`, `"`, or newlines)

## Dependencies

None beyond the JS `Date` API (no imports from other `core/` modules).

## Invariants

- Empty kittens/sessions arrays produce a valid (minimal) CSV: `Grams\n\nOunces`
- `buildCsv` is pure and deterministic given the same logical data regardless of input array ordering
