# src/core/time/

Local-time bucket helpers. Used by display logic and by graph daily-averaging.

## Outputs / Contract

- `startOfLocalDay(millis) → number` — millis at 00:00:00.000 in the local timezone for the day containing `millis`
- `isSameLocalDay(a, b) → boolean` — true iff `a` and `b` fall on the same local-timezone day
- `localDayKey(millis) → string` — `YYYY-MM-DD` for the local day; useful as a Map key when grouping by day
- `addDays(millis, days) → number` — millis advanced by N local days (handles DST correctly)
- `localDayDiff(later, earlier) → number` — whole local days between two timestamps (`later` − `earlier`); negative if `later` precedes `earlier`

## Dependencies

None. Built on the JS `Date` API only.

## Invariants

- All helpers operate in the runtime's local timezone (whatever `Intl` / `Date` reports)
- `startOfLocalDay(startOfLocalDay(x)) === startOfLocalDay(x)` (idempotent)
- `isSameLocalDay(a, b) === (startOfLocalDay(a) === startOfLocalDay(b))`
- `localDayKey(x)` is stable: same local day in → same string out
- `addDays(x, 0) === startOfLocalDay(x)` is **not** guaranteed; `addDays` preserves time-of-day. Use `startOfLocalDay` first if midnight semantics are required.

## Why local, not UTC?

Foster mama records weights in her wall-clock day. Bucketing must use her local day, not UTC. A weighing at 11:30 PM local on Tuesday belongs to Tuesday's data, not to early Wednesday UTC.
