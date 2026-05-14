const FOLDER_ID_KEY = 'beancounter:drive-folder-id'
const FOLDER_NAME_KEY = 'beancounter:drive-folder-name'

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

export function clearStoredFolder(): void {
  safeRemove(FOLDER_ID_KEY)
  safeRemove(FOLDER_NAME_KEY)
}

export function hasStoredConnection(): boolean {
  return getStoredFolderId() !== null
}
