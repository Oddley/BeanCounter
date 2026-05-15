const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const JSON_MIME = 'application/json'

export interface DriveFile {
  readonly id: string
  readonly name: string
  readonly modifiedTime: string
  readonly mimeType: string
}

export class DriveError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'DriveError'
  }
}

export function escapeDriveQueryString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

async function driveFetch(
  token: string,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(url, { ...init, headers })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new DriveError(
      `Drive API ${response.status} ${response.statusText}: ${text}`,
      response.status,
    )
  }
  return response
}

export async function listFiles(
  token: string,
  query: string,
): Promise<readonly DriveFile[]> {
  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(
    query,
  )}&fields=files(id,name,modifiedTime,mimeType)&pageSize=1000`
  const response = await driveFetch(token, url)
  const data = (await response.json()) as { files?: DriveFile[] }
  return data.files ?? []
}

export async function findOrCreateFolder(
  token: string,
  name: string,
  parentId?: string,
): Promise<string> {
  const escapedName = escapeDriveQueryString(name)
  const parentClause =
    parentId !== undefined ? `'${parentId}' in parents and ` : ''
  const query = `${parentClause}name = '${escapedName}' and mimeType = '${FOLDER_MIME}' and trashed = false`

  const existing = await listFiles(token, query)
  const first = existing[0]
  if (first !== undefined) return first.id

  const response = await driveFetch(token, `${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: { 'Content-Type': JSON_MIME },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      ...(parentId !== undefined ? { parents: [parentId] } : {}),
    }),
  })
  const data = (await response.json()) as DriveFile
  return data.id
}

export async function readFileContent(
  token: string,
  fileId: string,
): Promise<string> {
  const url = `${DRIVE_API_BASE}/files/${fileId}?alt=media`
  const response = await driveFetch(token, url)
  return response.text()
}

export interface WriteFileOptions {
  readonly name: string
  readonly parentId: string
  readonly content: string
  readonly existingFileId?: string
  readonly mimeType?: string
}

export async function writeFile(
  token: string,
  options: WriteFileOptions,
): Promise<string> {
  const mimeType = options.mimeType ?? JSON_MIME

  if (options.existingFileId !== undefined) {
    const url = `${DRIVE_UPLOAD_BASE}/files/${options.existingFileId}?uploadType=media`
    const response = await driveFetch(token, url, {
      method: 'PATCH',
      headers: { 'Content-Type': mimeType },
      body: options.content,
    })
    const data = (await response.json()) as DriveFile
    return data.id
  }

  const boundary = `beancounter_${Math.random().toString(36).slice(2)}`
  const body =
    `--${boundary}\r\n` +
    `Content-Type: ${JSON_MIME}; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify({ name: options.name, parents: [options.parentId] })}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n` +
    `${options.content}\r\n` +
    `--${boundary}--\r\n`

  const url = `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart`
  const response = await driveFetch(token, url, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  const data = (await response.json()) as DriveFile
  return data.id
}

export interface SharePermissionOptions {
  readonly fileId: string
  readonly email: string
  readonly emailMessage?: string
  readonly role?: 'reader' | 'writer'
}

export interface SharePermissionResult {
  readonly permissionId: string
}

// Grant another Google account access to a Drive file/folder. We always
// request `sendNotificationEmail=true` so Google sends the recipient a
// share notification with our `emailMessage` injected — that's the
// channel the deep-link invite URL rides on.
//
// Requires the caller's token to have permission to share the file
// (the user must own it or have been granted editor-or-higher access).
export async function sharePermission(
  token: string,
  options: SharePermissionOptions,
): Promise<SharePermissionResult> {
  const role = options.role ?? 'writer'
  const params = new URLSearchParams({
    sendNotificationEmail: 'true',
    fields: 'id',
  })
  if (options.emailMessage !== undefined && options.emailMessage !== '') {
    params.set('emailMessage', options.emailMessage)
  }
  const url = `${DRIVE_API_BASE}/files/${options.fileId}/permissions?${params.toString()}`
  const response = await driveFetch(token, url, {
    method: 'POST',
    headers: { 'Content-Type': JSON_MIME },
    body: JSON.stringify({
      type: 'user',
      role,
      emailAddress: options.email,
    }),
  })
  const data = (await response.json()) as { id: string }
  return { permissionId: data.id }
}
