# src/core/settings/

Application-wide singleton settings. In Phase 1, the only field is the optional sticky-litter selection.

## Outputs / Contract

- `AppSettings` interface — `{ stickyLitterId }`
- `NullAppSettings` — Null Object substitutable for `AppSettings`
- `setStickyLitter(settings, litterId) → AppSettings` — pin a litter as default landing target
- `clearStickyLitter(settings) → AppSettings` — unpin
- `hasStickyLitter(settings) → boolean` — is anything currently pinned?

## Encapsulation

`stickyLitterId` is a string. Empty string means "no sticky." Consumers must use `hasStickyLitter` to check rather than comparing the string directly — the empty-string sentinel is an implementation detail of this module.

## Dependencies

None at runtime.

## Invariants

- All transformations return new `AppSettings` objects (immutable input)
- `NullAppSettings.stickyLitterId` is empty string
- `hasStickyLitter(NullAppSettings)` is `false`
- A future migration may extend `AppSettings` with theme, sync config, etc. — Phase 1 keeps the surface minimal.
