# src/shell/auth/

Google Identity Services (GSI) + Google Picker integration. Manages OAuth tokens, folder selection, and the persistent "user has connected" state.

## Files

- `gsi.ts` — wraps GSI's `initTokenClient` + `requestAccessToken`; dynamic script load; in-memory token cache; both `requestToken` (with consent UI) and `requestTokenSilently` (with `prompt: 'none'`)
- `picker.ts` — wraps Google Picker (`gapi.load('picker')`); `pickFolder(token)` opens a folder picker with both "My Drive" and "Shared with me" views; returns the chosen folder id+name or `null` on cancel
- `connection.ts` — localStorage persistence of the user-chosen folder id+name; survives across sessions
- `index.ts` — barrel

## Outputs / Contract

- `isAuthConfigured() → boolean` — true iff `VITE_GOOGLE_CLIENT_ID` is set; gate the Connect button on this
- `requestToken() → Promise<Token>` — opens GSI consent UI; resolves with `{ accessToken, expiresAt }` or rejects
- `getCurrentToken() → string | null` — synchronous accessor for valid token; null if expired or missing
- `clearToken()` — wipes in-memory token (used during disconnect — Phase 4.5)

## Scope

`https://www.googleapis.com/auth/drive.file` — access to files this app created OR files the user explicitly opens via the Picker (sufficient for multi-user shared folders per ADR-007).

## Token Storage

In-memory only. Token is regenerated via GSI on each app start; if the user previously connected (folder id present in localStorage) the boot flow calls `requestTokenSilently` to refresh without UI. Tokens are NEVER persisted to localStorage or IndexedDB.

## Folder Storage

The user-chosen Drive folder id and name persist in `localStorage` keyed under `beancounter:drive-folder-*`. Folder id is device-local config (different devices may have different ids pointing at the same Drive folder via Drive's sharing), not user data, so it stays outside Dexie + outside the `active.json` blob.

## Dependencies

- Loads `https://accounts.google.com/gsi/client` (GSI OAuth) and `https://apis.google.com/js/api.js` (gapi Picker) dynamically on first use
- Reads `import.meta.env.VITE_GOOGLE_CLIENT_ID` for the OAuth client ID
- Reads `import.meta.env.VITE_GOOGLE_API_KEY` for the Picker API key

## Invariants

- One token request in flight at a time; concurrent calls to `requestToken()` reject the second
- `getCurrentToken()` returns null within the 60-second refresh margin before expiry (forces a refresh)
- GSI script load is cached — subsequent calls reuse the same Promise
