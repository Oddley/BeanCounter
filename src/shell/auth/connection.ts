const FOLDER_ID_KEY = 'beancounter:drive-folder-id'
const FOLDER_NAME_KEY = 'beancounter:drive-folder-name'
const FILE_ID_KEY = 'beancounter:drive-file-id'

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* localStorage may be unavailable; non-fatal */
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* non-fatal */
  }
}

export function getStoredFolderId(): string | null {
  return safeGet(FOLDER_ID_KEY)
}

export function getStoredFolderName(): string | null {
  return safeGet(FOLDER_NAME_KEY)
}

export function setStoredFolder(id: string, name: string): void {
  safeSet(FOLDER_ID_KEY, id)
  safeSet(FOLDER_NAME_KEY, name)
}

// File ID of the active.json the user is connected to. Populated:
//   - by the invite-accept flow (recipient picks active.json directly,
//     drive.file scope is granted ONLY for that file — folder-search
//     queries return empty for them so we need to use the file id
//     directly for inspect/read operations)
//   - by the fresh-connect flow after first push (writeFile returns
//     the new file id; store it so subsequent inspects use the fast
//     direct-fetch path)
// When present, sync code should prefer file-id-based access over
// folder-search-based access.
export function getStoredFileId(): string | null {
  return safeGet(FILE_ID_KEY)
}

export function setStoredFileId(id: string): void {
  safeSet(FILE_ID_KEY, id)
}

export function clearStoredFolder(): void {
  safeRemove(FOLDER_ID_KEY)
  safeRemove(FOLDER_NAME_KEY)
  safeRemove(FILE_ID_KEY)
}

export function hasStoredConnection(): boolean {
  return getStoredFolderId() !== null
}
