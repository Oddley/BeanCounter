# src/core/invite/

Pure helpers for the multi-user invite link format.

## Contract

- `parseInviteParams(URLSearchParams) → InviteRequest` — discriminated-union result. Defensive against missing / empty / implausibly long folder IDs.
- `buildInviteUrl({ origin, folderId, folderName }) → string` — round-trips with `parseInviteParams`.
- `NULL_INVITE` — typed-absence singleton for "no invite present yet" (ADR-004).

## URL Shape

```
<origin>/invite?folderId=<driveFolderId>&name=<urlEncodedFolderName>
```

The `name` param is a display convenience for the accept-side UI ("Mama invited you to join 'Bean Counter Household'"). It's NOT used for any access decision — the folder ID is the only identifier that matters for Drive.

## Invariants

- `folderId` is non-empty and not whitespace-only after trimming
- `folderId` length is bounded (200 chars) to reject obviously malformed input
- `folderName` defaults to `'your shared folder'` when absent or empty
- Unknown / unrelated params are ignored (room for utm_source etc.)

## Dependencies

None — pure URL/string handling.
