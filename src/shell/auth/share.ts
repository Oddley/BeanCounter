// Wraps Google's native Drive share-dialog widget (gapi.drive.share.
// ShareClient). Lets us pop Drive's standard "Share with people"
// dialog from BC — Mama enters caregiver emails inside Google's own UI,
// Drive handles the actual permission grant through her session
// cookies. We avoid permissions.create entirely, which 404s for
// non-GCP-project-member accounts with drive.file scope.

import type { DriveShareClient } from './globals'

const GAPI_SCRIPT_URL = 'https://apis.google.com/js/api.js'

let gapiScriptPromise: Promise<void> | null = null
let driveShareLoadPromise: Promise<void> | null = null

// Same pattern as picker.ts — share this if it grows, but cheap to
// keep alongside since it's a tiny idempotent script load.
function ensureGapiLoaded(): Promise<void> {
  if (gapiScriptPromise) return gapiScriptPromise
  gapiScriptPromise = new Promise<void>((resolve, reject) => {
    if (window.gapi) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = GAPI_SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () => {
      resolve()
    }
    script.onerror = () => {
      reject(new Error('Failed to load gapi (apis.google.com) script'))
    }
    document.head.appendChild(script)
  })
  return gapiScriptPromise
}

function loadDriveShareModule(): Promise<void> {
  if (driveShareLoadPromise) return driveShareLoadPromise
  driveShareLoadPromise = ensureGapiLoaded().then(
    () =>
      new Promise<void>((resolve, reject) => {
        const gapi = window.gapi
        if (!gapi) {
          reject(new Error('gapi unexpectedly absent after script load'))
          return
        }
        gapi.load('drive-share', {
          callback: () => {
            resolve()
          },
          onerror: () => {
            reject(new Error('gapi failed to load drive-share module'))
          },
        })
      }),
  )
  return driveShareLoadPromise
}

// Open Google's native Drive share dialog over the current page. The
// dialog runs inside an embedded Google iframe authenticated by the
// user's session cookies — it doesn't depend on our OAuth scope being
// broad enough to share files. Returns immediately after the dialog
// is shown; the dialog manages its own lifecycle and the user
// dismisses it.
//
// Note: ShareClient has no programmatic "dialog closed" callback in the
// current public API. Callers wanting to react to dialog close must
// surface follow-up UI in the existing page chrome rather than waiting
// for a promise resolution.
export async function openDriveShareDialog(
  accessToken: string,
  folderId: string,
): Promise<void> {
  await loadDriveShareModule()
  // Drive Share Client lives on gapi.drive.share, not google.drive.share
  // (unlike the Picker which is on google.picker). Inconsistency in
  // Google's namespaces — easy to get wrong on first attempt.
  const share = window.gapi?.drive?.share
  if (!share) {
    throw new Error(
      'Drive Share Client failed to initialize (gapi.drive.share missing)',
    )
  }
  const client: DriveShareClient = new share.ShareClient()
  client.setOAuthToken(accessToken)
  client.setItemIds([folderId])
  client.showSettingsDialog()
}
