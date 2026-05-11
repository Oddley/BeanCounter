# src/core/graph/

Pure series construction for the weight visualization. Joins kittens × sessions × weight entries into plottable per-kitten timeseries.

## Outputs / Contract

- `SeriesPoint` — `{ time, grams }` (millis, grams)
- `KittenSeries` — `{ kittenId, displayName, order, points }` — one per kitten the consumer asked about
- `GraphMode` — `'rough' | 'smooth'`
- `buildSeries({ kittens, sessions, weightEntries, mode }) → KittenSeries[]` — main entry point
- `yAxisRange(series) → { min, max }` — padded range across all points; non-zero-based per MVP spec
- `xAxisRange(series) → { min, max }` — time range across all points; no padding

## Inputs

- `kittens` — the kittens to render. Caller chooses (e.g., active only, or one kitten for focus mode). Result preserves input order.
- `sessions` — all sessions that might be referenced. Used to look up `effectiveRecordedAt` per session, which becomes the X coordinate for each entry.
- `weightEntries` — all weight entries to consider. Entries referencing absent sessions are skipped.

## Modes

**Rough**: one point per weight entry, at `session.effectiveRecordedAt`, sorted by time.

**Smooth**: bucket by local day, average grams within each day, then linearly interpolate one synthetic point per missing day between first and last known day. Produces a dense daily series.

## Dependencies

- `core/session` for `effectiveRecordedAt`
- `core/time` for `startOfLocalDay`, `localDayDiff`, `addDays`

## Invariants

- Output array length matches input `kittens.length` (kittens with no entries get `points: []`)
- Output order matches input `kittens` order
- Within a series, points are sorted by `time` ascending
- Smooth mode: if a kitten has only one recorded day, output is one point (no interpolation possible)
- Smooth mode: synthetic interpolated points are NOT marked specially; the consumer treats them like any other point. The "honest" feedback chose interpolation explicitly.
- `yAxisRange.max >= yAxisRange.min`; identical values get small synthetic padding (5g) so the chart still renders sensibly
- All functions pure: no mutation of inputs, no IO, no time-of-day dependency (caller supplies all timestamps)
