import { describe, it, expect } from 'vitest'
import { newId, isValidId } from './ids'

describe('newId', () => {
  it('returns a v4 UUID-formatted string', () => {
    const id = newId()
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  it('produces a different value on each call', () => {
    expect(newId()).not.toBe(newId())
  })
})

describe('isValidId', () => {
  it('returns true for a v4 UUID produced by newId', () => {
    expect(isValidId(newId())).toBe(true)
  })

  it('returns false for an empty string', () => {
    expect(isValidId('')).toBe(false)
  })

  it('returns false for a non-UUID string', () => {
    expect(isValidId('not-a-uuid')).toBe(false)
  })

  it('returns false for a v1 UUID (timestamp-based, not v4)', () => {
    expect(isValidId('5c2efbf0-a8ad-11ee-9c20-0242ac120002')).toBe(false)
  })

  it('returns false for a string of the right length but wrong format', () => {
    expect(isValidId('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx')).toBe(false)
  })
})
