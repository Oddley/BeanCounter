# src/core/settings/

Application-wide singleton settings. Phase 1 had only sticky-litter; Phase 4b adds `lastUpdatedAt` for sync.

## Outputs / Contract

- `AppSettings` interface — `{ stickyLitterId, lastUpdatedAt }`
- `NullAppSettings` — Null Object substitutable for `AppSettings`
- `setStickyLitter(settings, litterId, now) → AppSettings` — pin; bumps lastUpdatedAt
- `clearStickyLitter(settings, now) → AppSettings` — unpin; bumps lastUpdatedAt
- `hasStickyLitter(settings) → boolean` — is anything currently pinned?

## Encapsulation

`stickyLitterId` is a string. Empty string means "no sticky." Consumers must use `hasStickyLitter` to check rather than comparing the string directly — the empty-string sentinel is an implementation detail of this module.

## Dependencies

None at runtime. Shell supplies `now` at mutation time (dependency inversion per ADR-002).

## Invariants

- All transformations return new `AppSettings` objects (immutable input)
- Every mutator bumps `lastUpdatedAt` — sync uses it for per-entity LWW merge (ADR-007)
- `NullAppSettings.stickyLitterId` is empty string
- `NullAppSettings.lastUpdatedAt === 0` — treated as "older than any real write" by sync merge
- `hasStickyLitter(NullAppSettings)` is `false`
