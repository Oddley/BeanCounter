import type { GsiTokenClient } from './globals'

const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
const TOKEN_REFRESH_MARGIN_MS = 60_000

export interface AuthToken {
  readonly accessToken: string
  readonly expiresAt: number
}

let scriptLoadPromise: Promise<void> | null = null
let tokenClient: GsiTokenClient | null = null
let resolveCurrent: ((token: AuthToken) => void) | null = null
let rejectCurrent: ((error: Error) => void) | null = null
let currentToken: AuthToken | null = null

function getClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
}

export function isAuthConfigured(): boolean {
  return getClientId() !== ''
}

function loadGsiScript(): Promise<void> {
  if (scriptLoadPromise) return scriptLoadPromise
  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = GSI_SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () => {
      resolve()
    }
    script.onerror = () => {
      reject(new Error('Failed to load Google Identity Services script'))
    }
    document.head.appendChild(script)
  })
  return scriptLoadPromise
}

async function ensureTokenClient(): Promise<GsiTokenClient> {
  if (tokenClient) return tokenClient
  await loadGsiScript()
  const clientId = getClientId()
  if (!clientId) {
    throw new Error(
      'Google client ID is not configured — set VITE_GOOGLE_CLIENT_ID in .env.local',
    )
  }
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) {
    throw new Error('Google Identity Services failed to initialize')
  }
  tokenClient = oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    callback: (response) => {
      const resolve = resolveCurrent
      const reject = rejectCurrent
      resolveCurrent = null
      rejectCurrent = null
      if (response.error !== undefined || !response.access_token) {
        reject?.(
          new Error(response.error ?? 'GSI returned no access_token'),
        )
        return
      }
      const expiresIn = response.expires_in ?? 3600
      const token: AuthToken = {
        accessToken: response.access_token,
        expiresAt: Date.now() + expiresIn * 1000,
      }
      currentToken = token
      resolve?.(token)
    },
    error_callback: (err) => {
      const reject = rejectCurrent
      resolveCurrent = null
      rejectCurrent = null
      const suffix = err.message !== undefined ? ` — ${err.message}` : ''
      reject?.(new Error(`OAuth error: ${err.type}${suffix}`))
    },
  })
  return tokenClient
}

export async function requestToken(): Promise<AuthToken> {
  const client = await ensureTokenClient()
  return new Promise<AuthToken>((resolve, reject) => {
    if (resolveCurrent !== null || rejectCurrent !== null) {
      reject(new Error('Token request already in flight'))
      return
    }
    resolveCurrent = resolve
    rejectCurrent = reject
    client.requestAccessToken()
  })
}

// Attempt to refresh the access token without showing UI. Succeeds if the user
// still has an active Google session in this browser AND has previously
// authorized this app. Rejects on failure (caller falls back to requestToken).
export async function requestTokenSilently(): Promise<AuthToken> {
  const client = await ensureTokenClient()
  return new Promise<AuthToken>((resolve, reject) => {
    if (resolveCurrent !== null || rejectCurrent !== null) {
      reject(new Error('Token request already in flight'))
      return
    }
    resolveCurrent = resolve
    rejectCurrent = reject
    client.requestAccessToken({ prompt: 'none' })
  })
}

export function getCurrentToken(): string | null {
  if (!currentToken) return null
  if (Date.now() >= currentToken.expiresAt - TOKEN_REFRESH_MARGIN_MS) {
    return null
  }
  return currentToken.accessToken
}

export function hasToken(): boolean {
  return getCurrentToken() !== null
}

export function clearToken(): void {
  currentToken = null
}

// Returns a valid access token, attempting silent refresh if the cached
// one is missing/expired. Returns null if the user needs to perform an
// interactive consent flow (which requires a user gesture).
export async function getValidToken(): Promise<string | null> {
  const cached = getCurrentToken()
  if (cached !== null) return cached
  try {
    const fresh = await requestTokenSilently()
    return fresh.accessToken
  } catch {
    return null
  }
}
