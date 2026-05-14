import type { PickerCallbackData } from './globals'

const GAPI_SCRIPT_URL = 'https://apis.google.com/js/api.js'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

let gapiScriptPromise: Promise<void> | null = null
let pickerLoadPromise: Promise<void> | null = null

function getApiKey(): string {
  return import.meta.env.VITE_GOOGLE_API_KEY ?? ''
}

export function isPickerConfigured(): boolean {
  return getApiKey() !== ''
}

function loadGapiScript(): Promise<void> {
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

function loadPickerModule(): Promise<void> {
  if (pickerLoadPromise) return pickerLoadPromise
  pickerLoadPromise = loadGapiScript().then(
    () =>
      new Promise<void>((resolve, reject) => {
        const gapi = window.gapi
        if (!gapi) {
          reject(new Error('gapi unexpectedly absent after script load'))
          return
        }
        gapi.load('picker', {
          callback: () => {
            resolve()
          },
          onerror: () => {
            reject(new Error('gapi failed to load picker module'))
          },
        })
      }),
  )
  return pickerLoadPromise
}

export interface PickedFolder {
  readonly id: string
  readonly name: string
}

export async function pickFolder(
  accessToken: string,
): Promise<PickedFolder | null> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error(
      'Google API key is not configured — set VITE_GOOGLE_API_KEY in .env.local',
    )
  }
  await loadPickerModule()
  const picker = window.google?.picker
  if (!picker) {
    throw new Error('Google Picker library failed to initialize')
  }

  return new Promise<PickedFolder | null>((resolve, reject) => {
    try {
      const myDriveView = new picker.DocsView(picker.ViewId.FOLDERS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMimeTypes(FOLDER_MIME)

      const sharedView = new picker.DocsView(picker.ViewId.FOLDERS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMimeTypes(FOLDER_MIME)
        .setOwnedByMe(false)

      const built = new picker.PickerBuilder()
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        .setTitle('Choose a Bean Counter folder')
        .addView(myDriveView)
        .addView(sharedView)
        .setCallback((data: PickerCallbackData) => {
          if (data.action === picker.Action.PICKED) {
            const doc = data.docs?.[0]
            if (doc) {
              resolve({ id: doc.id, name: doc.name })
            } else {
              resolve(null)
            }
          } else if (data.action === picker.Action.CANCEL) {
            resolve(null)
          }
        })
        .build()

      built.setVisible(true)
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Picker failed to open'))
    }
  })
}
