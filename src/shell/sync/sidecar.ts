import {
  getStoredFolderId,
  getStoredFileId,
  getStoredFolderName,
  setStoredFolder,
  setStoredFileId,
} from '../auth'
import { parseActiveFile } from '../../core/active-file'
import { DriveError } from '../drive'
import { type InspectionResult } from './first-connect'

// ── Config ───────────────────────────────────────────────────────────────────

const SIDECAR_BASE = 'http://localhost:7734'
// Short timeout: if the service isn't running we want to know fast and fall
// back to the browser OAuth path without making the user wait.
const TIMEOUT_MS = 1500

// ── Internal fetch helper ─────────────────────────────────────────────────────

async function sidecarFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(`${SIDECAR_BASE}${path}`, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns true if the Android sidecar service is reachable on localhost:7734.
 * Fast-fails (1.5 s timeout) so the caller can decide quickly whether to use
 * the sidecar path or fall back to browser OAuth.
 */
export async function isSidecarAvailable(): Promise<boolean> {
  try {
    const res = await sidecarFetch('/ping')
    return res.ok
  } catch {
    return false
  }
}

/**
 * Returns the connection (folderId / fileId / folderName) stored in the sidecar.
 * Used by the setup wizard to adopt the Android app's stored folder without
 * requiring the user to go through the Google Picker again.
 */
export async function getSidecarConnection(): Promise<{
  folderId?: string
  fileId?: string
  folderName?: string
} | null> {
  try {
    const res = await sidecarFetch('/connection')
    if (!res.ok) return null
    return (await res.json()) as {
      folderId?: string
      fileId?: string
      folderName?: string
    }
  } catch {
    return null
  }
}

/**
 * Pushes the PWA's stored folderId / fileId / folderName to the sidecar so
 * the Android service knows which Drive file to sync. Called once at the
 * start of each sync run when the sidecar is detected.
 */
export async function pushConnectionToSidecar(): Promise<void> {
  const folderId = getStoredFolderId()
  if (folderId === null) return
  const fileId = getStoredFileId()
  const folderName = getStoredFolderName()
  await sidecarFetch('/connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      folderId,
      ...(fileId !== null ? { fileId } : {}),
      ...(folderName !== null ? { folderName } : {}),
    }),
  })
}

/**
 * Inspects the Drive file via the sidecar service.
 * Drop-in replacement for `inspectDrive()` from `./first-connect`.
 */
export async function sidecarInspect(
  folderId: string,
  knownFileId?: string,
): Promise<InspectionResult> {
  const params = new URLSearchParams({ folderId })
  if (knownFileId !== undefined) params.set('fileId', knownFileId)

  const res = await sidecarFetch(`/inspect?${params.toString()}`)
  if (!res.ok) throw new Error(`Sidecar inspect failed: ${res.status}`)

  const data = (await res.json()) as {
    kind: 'empty' | 'exists' | 'unreadable'
    folderId: string
    fileId?: string
    content?: string
    etag?: string
    error?: string
  }

  if (data.kind === 'empty') {
    return { kind: 'empty', folderId: data.folderId }
  }

  if (data.kind === 'exists') {
    const parsed = parseActiveFile(data.content ?? '')
    if (!parsed.ok) {
      return {
        kind: 'unreadable',
        folderId: data.folderId,
        fileId: data.fileId!,
        error: parsed.error,
      }
    }
    return {
      kind: 'exists',
      folderId: data.folderId,
      fileId: data.fileId!,
      file: parsed.file,
      etag: data.etag ?? null,
    }
  }

  // 'unreadable'
  return {
    kind: 'unreadable',
    folderId: data.folderId,
    fileId: data.fileId ?? '',
    error: data.error ?? 'Unreadable',
  }
}

/**
 * Writes the active.json file via the sidecar service.
 * Drop-in replacement for `pushSnapshot()` from `./orchestrator`.
 * Throws `DriveError(412)` on etag mismatch so the orchestrator's retry
 * logic handles it identically to a direct Drive write.
 */
export async function sidecarWrite(options: {
  readonly folderId: string
  readonly content: string
  readonly existingFileId?: string
  readonly fileName: string
  readonly ifMatch?: string
}): Promise<string> {
  const res = await sidecarFetch('/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  })

  if (res.status === 412) {
    // Mirror DriveError(412) so the orchestrator's optimistic-concurrency
    // retry loop fires exactly as it does for a direct Drive write.
    throw new DriveError('Precondition failed (ETag mismatch via sidecar)', 412)
  }

  if (!res.ok) throw new Error(`Sidecar write failed: ${res.status}`)
  const data = (await res.json()) as { fileId: string }
  return data.fileId
}

/**
 * Adopts the sidecar's stored folder as the PWA's active connection.
 * Returns true if a folderId was available and was adopted, false if the
 * sidecar has no folder stored yet (user still needs to pick one).
 */
export async function adoptSidecarConnection(): Promise<boolean> {
  const conn = await getSidecarConnection()
  if (conn === null || conn.folderId === undefined) return false
  setStoredFolder(conn.folderId, conn.folderName ?? conn.folderId)
  if (conn.fileId !== undefined) setStoredFileId(conn.fileId)
  return true
}
