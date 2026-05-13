# src/shell/auth/

Google Identity Services (GSI) integration. Manages OAuth token lifecycle for Drive API access.

## Files

- `gsi.ts` — wraps GSI's `initTokenClient` + `requestAccessToken`; dynamic script load; in-memory token cache
- `index.ts` — barrel

## Outputs / Contract

- `isAuthConfigured() → boolean` — true iff `VITE_GOOGLE_CLIENT_ID` is set; gate the Connect button on this
- `requestToken() → Promise<Token>` — opens GSI consent UI; resolves with `{ accessToken, expiresAt }` or rejects
- `getCurrentToken() → string | null` — synchronous accessor for valid token; null if expired or missing
- `clearToken()` — wipes in-memory token (used during disconnect — Phase 4.5)

## Scope

`https://www.googleapis.com/auth/drive.file` — access only files our app created. No broader Drive access requested.

## Token Storage

In-memory only. Token is regenerated via GSI on each app start (silent refresh comes in Phase 4d/4.5). Tokens are NEVER persisted to localStorage or IndexedDB.

## Dependencies

- Loads `https://accounts.google.com/gsi/client` script dynamically on first use
- Reads `import.meta.env.VITE_GOOGLE_CLIENT_ID` for the OAuth client ID

## Invariants

- One token request in flight at a time; concurrent calls to `requestToken()` reject the second
- `getCurrentToken()` returns null within the 60-second refresh margin before expiry (forces a refresh)
- GSI script load is cached — subsequent calls reuse the same Promise
