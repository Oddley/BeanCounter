import { describe, it, expect } from 'vitest'
import {
  parseInviteParams,
  buildInviteUrl,
  NULL_INVITE,
  type InviteRequest,
} from './invite'

describe('parseInviteParams', () => {
  it('returns valid for well-formed params', () => {
    const params = new URLSearchParams({
      folderId: '1A2B3C',
      name: 'Bean Counter Household',
    })
    const result = parseInviteParams(params)
    expect(result).toEqual<InviteRequest>({
      kind: 'valid',
      folderId: '1A2B3C',
      folderName: 'Bean Counter Household',
    })
  })

  it('decodes URL-encoded folder name (the realistic input path)', () => {
    // Simulate what URL().searchParams produces when navigating to
    // /invite?folderId=abc&name=Mama%20%26%20Dad%27s%20Litter
    const url = new URL(
      'https://example.com/invite?folderId=abc&name=Mama%20%26%20Dad%27s%20Litter',
    )
    const result = parseInviteParams(url.searchParams)
    expect(result.kind).toBe('valid')
    if (result.kind === 'valid') {
      expect(result.folderName).toBe("Mama & Dad's Litter")
    }
  })

  it("defaults to a generic name when 'name' is missing", () => {
    const params = new URLSearchParams({ folderId: 'abc' })
    const result = parseInviteParams(params)
    expect(result).toEqual<InviteRequest>({
      kind: 'valid',
      folderId: 'abc',
      folderName: 'your shared folder',
    })
  })

  it('rejects when folderId is missing', () => {
    const params = new URLSearchParams({ name: 'something' })
    const result = parseInviteParams(params)
    expect(result.kind).toBe('invalid')
    if (result.kind === 'invalid') {
      expect(result.reason).toMatch(/folderId/i)
    }
  })

  it('rejects when folderId is empty', () => {
    const params = new URLSearchParams({ folderId: '', name: 'x' })
    const result = parseInviteParams(params)
    expect(result.kind).toBe('invalid')
  })

  it('rejects when folderId is whitespace-only', () => {
    const params = new URLSearchParams({ folderId: '   ', name: 'x' })
    const result = parseInviteParams(params)
    expect(result.kind).toBe('invalid')
  })

  it('rejects when folderId is implausibly long (defensive)', () => {
    // Drive folder IDs are ~28 chars. 500 chars is suspicious.
    const params = new URLSearchParams({
      folderId: 'a'.repeat(500),
      name: 'x',
    })
    const result = parseInviteParams(params)
    expect(result.kind).toBe('invalid')
  })

  it('ignores unrelated params', () => {
    const params = new URLSearchParams({
      folderId: 'abc',
      name: 'x',
      utm_source: 'email',
      extraneous: 'whatever',
    })
    const result = parseInviteParams(params)
    expect(result.kind).toBe('valid')
  })
})

describe('buildInviteUrl', () => {
  it('builds a fully-qualified invite URL from origin + folder', () => {
    const url = buildInviteUrl({
      origin: 'https://bean-counter.example.workers.dev',
      folderId: '1A2B3C',
      folderName: 'Bean Counter Household',
    })
    expect(url).toBe(
      'https://bean-counter.example.workers.dev/invite?folderId=1A2B3C&name=Bean+Counter+Household',
    )
  })

  it('strips a trailing slash from origin', () => {
    const url = buildInviteUrl({
      origin: 'https://example.com/',
      folderId: 'abc',
      folderName: 'x',
    })
    expect(url).toBe('https://example.com/invite?folderId=abc&name=x')
  })

  it('url-encodes special characters in folder name', () => {
    const url = buildInviteUrl({
      origin: 'https://example.com',
      folderId: 'abc',
      folderName: "Mama & Dad's Litter",
    })
    // URLSearchParams uses + for spaces (form encoding); special chars escaped
    expect(url).toContain('name=Mama+%26+Dad%27s+Litter')
  })

  it('round-trips with parseInviteParams', () => {
    const original = {
      folderId: 'abc123',
      folderName: "Mama & Dad's",
    }
    const url = buildInviteUrl({
      origin: 'https://example.com',
      ...original,
    })
    const search = new URL(url).searchParams
    const parsed = parseInviteParams(search)
    expect(parsed).toEqual<InviteRequest>({
      kind: 'valid',
      folderId: original.folderId,
      folderName: original.folderName,
    })
  })
})

describe('NULL_INVITE', () => {
  it('is an invalid InviteRequest', () => {
    expect(NULL_INVITE.kind).toBe('invalid')
  })
})
