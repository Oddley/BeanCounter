# src/core/session/

Feeding session domain: pure types and transformations for a feeding event (one session per active feeding cycle).

## Outputs / Contract

- `FeedingSession` interface — `{ id, litterId, createdAt, lastUpdatedAt, recordedAt, completed, lockAcquired }`
- `NullFeedingSession` — Null Object substitutable for `FeedingSession`
- `SessionStatus` — `'active' | 'completed' | 'stale'`
- `STALE_THRESHOLD_MS` — 30 × 60 × 1000 (30 minutes, per MVP spec)
- `createSession({ id, litterId, createdAt }) → FeedingSession` — new active session, lockAcquired=true, recordedAt=0
- `touchSession(session, now) → FeedingSession` — bumps lastUpdatedAt to `now`; used after every weight entry
- `completeSession(session) → FeedingSession` — marks completed=true (terminal state)
- `sessionStatus(session, now) → SessionStatus` — derives status from stored fields + current time
- `isStale(session, now) → boolean` — convenience predicate
- `effectiveRecordedAt(session) → number` — returns recordedAt if user-set (>0), else falls back to createdAt
- `setRecordedAt(session, time) → FeedingSession` — user override; pass a positive millis epoch
- `clearRecordedAt(session) → FeedingSession` — reset recordedAt to 0 (reverts to "Start of Weigh In" = createdAt)

## Why is status derived, not stored?

Stored fields are `completed` (boolean) and `lastUpdatedAt` (number). `stale` is a function of elapsed time since `lastUpdatedAt` — recomputing on read is correct (time keeps passing); storing a stale flag would require a background process to update it. The MVP spec lists status as a field, but the canonical source is time + completed flag.

## Dependencies

None at runtime.

## Invariants

- All transformations return new `FeedingSession` objects (immutable input)
- `completed=true` is terminal — completed sessions stay completed; touching one is a no-op
- `lastUpdatedAt >= createdAt` (touch only moves it forward; caller responsible for passing a sensible `now`)
- `sessionStatus(completed session, _) → 'completed'`
- `sessionStatus(uncompleted session, now)` where `now - lastUpdatedAt >= STALE_THRESHOLD_MS` → `'stale'`
- `sessionStatus(otherwise)` → `'active'`
- `lockAcquired` is set at creation; Phase 2 doesn't release or check it (Phase 4 sync may use it for multi-device conflict detection)
- `recordedAt === 0` means "no user override" — display logic falls back to `createdAt` ("Start of Weigh In" semantics)
- `recordedAt > 0` means the user explicitly set the weigh-in time; `effectiveRecordedAt` returns that value
- `NullFeedingSession.completed === false`, `NullFeedingSession.lastUpdatedAt === 0`, `NullFeedingSession.recordedAt === 0` — `sessionStatus(NullFeedingSession, now)` for any `now > 0` is `'stale'`
