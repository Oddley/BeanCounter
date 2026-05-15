export type InviteRequest =
  | { readonly kind: 'valid'; readonly folderId: string; readonly folderName: string }
  | { readonly kind: 'invalid'; readonly reason: string }

// Null Object per ADR-004: absence of a valid invite is its own typed
// thing rather than null/undefined. Useful for consumers that need a
// stable default before user navigation populates a real request.
export const NULL_INVITE: InviteRequest = {
  kind: 'invalid',
  reason: 'no invite parameters present',
}

const DEFAULT_FOLDER_NAME = 'your shared folder'

// Drive folder IDs are typically ~28 base64-ish characters. Anything
// much longer is either malformed or an attack vector — reject defensively.
const MAX_FOLDER_ID_LENGTH = 200

export function parseInviteParams(params: URLSearchParams): InviteRequest {
  const rawFolderId = params.get('folderId')
  if (rawFolderId === null) {
    return { kind: 'invalid', reason: 'missing folderId parameter' }
  }
  const folderId = rawFolderId.trim()
  if (folderId === '') {
    return { kind: 'invalid', reason: 'folderId parameter is empty' }
  }
  if (folderId.length > MAX_FOLDER_ID_LENGTH) {
    return { kind: 'invalid', reason: 'folderId is implausibly long' }
  }
  const rawName = params.get('name')
  const folderName =
    rawName !== null && rawName.trim() !== '' ? rawName : DEFAULT_FOLDER_NAME
  return { kind: 'valid', folderId, folderName }
}

export interface BuildInviteUrlInput {
  readonly origin: string
  readonly folderId: string
  readonly folderName: string
}

export function buildInviteUrl(input: BuildInviteUrlInput): string {
  const origin = input.origin.replace(/\/+$/, '')
  const params = new URLSearchParams({
    folderId: input.folderId,
    name: input.folderName,
  })
  return `${origin}/invite?${params.toString()}`
}
