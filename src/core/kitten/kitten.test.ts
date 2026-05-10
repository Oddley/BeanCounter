import { describe, it, expect } from 'vitest'
import {
  createKitten,
  archiveKitten,
  activateKitten,
  renameKitten,
  validateKittenName,
  defaultKittenName,
  NullKitten,
  type Kitten,
} from './index'

describe('createKitten', () => {
  it('returns a kitten with the given id, litterId, and displayName, active by default', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: 'Mittens',
    })
    expect(kitten).toEqual({
      id: 'k1',
      litterId: 'L1',
      displayName: 'Mittens',
      active: true,
    })
  })

  it('trims whitespace from the display name', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: '  Mittens  ',
    })
    expect(kitten.displayName).toBe('Mittens')
  })
})

describe('archiveKitten', () => {
  it('sets active to false', () => {
    const kitten = createKitten({ id: 'k1', litterId: 'L1', displayName: 'M' })
    expect(archiveKitten(kitten).active).toBe(false)
  })

  it('preserves other fields', () => {
    const kitten = createKitten({ id: 'k1', litterId: 'L1', displayName: 'M' })
    const archived = archiveKitten(kitten)
    expect(archived.id).toBe(kitten.id)
    expect(archived.litterId).toBe(kitten.litterId)
    expect(archived.displayName).toBe(kitten.displayName)
  })

  it('is idempotent', () => {
    const kitten = createKitten({ id: 'k1', litterId: 'L1', displayName: 'M' })
    expect(archiveKitten(archiveKitten(kitten))).toEqual(archiveKitten(kitten))
  })

  it('does not mutate the input', () => {
    const kitten = createKitten({ id: 'k1', litterId: 'L1', displayName: 'M' })
    archiveKitten(kitten)
    expect(kitten.active).toBe(true)
  })
})

describe('activateKitten', () => {
  it('sets active to true', () => {
    const archived = archiveKitten(
      createKitten({ id: 'k1', litterId: 'L1', displayName: 'M' }),
    )
    expect(activateKitten(archived).active).toBe(true)
  })

  it('is idempotent', () => {
    const kitten = createKitten({ id: 'k1', litterId: 'L1', displayName: 'M' })
    expect(activateKitten(activateKitten(kitten))).toEqual(
      activateKitten(kitten),
    )
  })
})

describe('renameKitten', () => {
  it('changes the display name', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: 'Old',
    })
    expect(renameKitten(kitten, 'New').displayName).toBe('New')
  })

  it('trims whitespace', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: 'Old',
    })
    expect(renameKitten(kitten, '  New  ').displayName).toBe('New')
  })

  it('preserves litterId', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: 'Old',
    })
    expect(renameKitten(kitten, 'New').litterId).toBe('L1')
  })
})

describe('validateKittenName', () => {
  it('accepts a normal name', () => {
    expect(validateKittenName('Mittens').valid).toBe(true)
  })

  it('rejects an empty string', () => {
    expect(validateKittenName('').valid).toBe(false)
  })

  it('rejects whitespace-only', () => {
    expect(validateKittenName('   ').valid).toBe(false)
  })

  it('rejects names over 50 characters', () => {
    expect(validateKittenName('x'.repeat(51)).valid).toBe(false)
  })

  it('accepts names exactly 50 characters', () => {
    expect(validateKittenName('x'.repeat(50)).valid).toBe(true)
  })
})

describe('defaultKittenName', () => {
  it('produces 1-indexed names', () => {
    expect(defaultKittenName(1)).toBe('Kitten 1')
    expect(defaultKittenName(2)).toBe('Kitten 2')
    expect(defaultKittenName(7)).toBe('Kitten 7')
  })

  it('passes its own validation', () => {
    expect(validateKittenName(defaultKittenName(1)).valid).toBe(true)
  })
})

describe('NullKitten', () => {
  it('has empty id', () => {
    expect(NullKitten.id).toBe('')
  })

  it('has displayable fallback name', () => {
    expect(NullKitten.displayName).toBe('Unknown')
  })

  it('is not active', () => {
    expect(NullKitten.active).toBe(false)
  })

  it('has empty litterId', () => {
    expect(NullKitten.litterId).toBe('')
  })

  it('is consumable by Kitten functions (Liskov substitutability)', () => {
    const archived = archiveKitten(NullKitten)
    const renamed = renameKitten(NullKitten, 'Anything')
    expect(archived.active).toBe(false)
    expect(renamed.displayName).toBe('Anything')
  })

  it('satisfies the Kitten interface', () => {
    const asKitten: Kitten = NullKitten
    expect(asKitten).toBeDefined()
  })
})
