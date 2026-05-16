# src/shell/drive/

Typed wrapper around the Google Drive REST API v3. All calls are scoped to `drive.file` — only files this app created are visible.

## Files

- `api.ts` — fetch-based wrappers for list, read, write, create-folder
- `index.ts` — barrel

## Outputs / Contract

- `DriveFile` — `{ id, name, modifiedTime, mimeType }`
- `DriveError` — thrown for non-2xx responses; carries HTTP status
- `listFiles(token, query) → DriveFile[]` — Drive search query syntax
- `findOrCreateFolder(token, name, parentId?) → folderId` — idempotent
- `readFileContent(token, fileId) → string` — UTF-8 text body
- `writeFile(token, options) → fileId` — create (multipart) or update (media) depending on `existingFileId`

Sharing/permission management is intentionally **not** in this layer. We tried `permissions.create` and it returned 404 for non-GCP-project-member accounts even with the right scope; we tried the embedded `gapi.drive.share.ShareClient` widget and it's been deprecated. The current invite flow opens the user's Drive folder in a new tab and they use Drive's native share button there. See `shell/routes/Settings.tsx` and `docs/post-1.0-audit.md` for the journey.

## Dependencies

- Token from `shell/auth.getCurrentToken()` — caller supplies it explicitly so this module stays I/O-only and reusable
- Browser `fetch`; no SDK / no `googleapis` package

## Invariants

- All operations require a valid access token; if Drive returns 401, the caller is responsible for re-auth (this module does not refresh)
- All operations are idempotent at the verb level: `findOrCreateFolder` returns the existing id if found
- Query strings with arbitrary user content must be passed through `escapeDriveQueryString` before being injected (apostrophe escape)
