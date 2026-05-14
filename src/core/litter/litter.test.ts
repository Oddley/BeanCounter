import { describe, it, expect } from 'vitest'
import {
  createLitter,
  archiveLitter,
  activateLitter,
  renameLitter,
  validateLitterName,
  NullLitter,
  type Litter,
} from './index'

describe('createLitter', () => {
  it('returns a litter with the given id, name, and lastUpdatedAt; active by default', () => {
    const litter = createLitter({
      id: 'abc-123',
      name: 'Test Litter',
      now: 1000,
    })
    expect(litter).toEqual({
      id: 'abc-123',
      name: 'Test Litter',
      active: true,
      lastUpdatedAt: 1000,
    })
  })

  it('trims whitespace from the name', () => {
    const litter = createLitter({ id: 'x', name: '  Padded  ', now: 0 })
    expect(litter.name).toBe('Padded')
  })

  it('preserves the now parameter as lastUpdatedAt', () => {
    const litter = createLitter({ id: 'x', name: 'Test', now: 42 })
    expect(litter.lastUpdatedAt).toBe(42)
  })
})

describe('archiveLitter', () => {
  it('sets active to false and updates lastUpdatedAt to now', () => {
    const litter = createLitter({ id: 'x', name: 'Test', now: 100 })
    const archived = archiveLitter(litter, 500)
    expect(archived.active).toBe(false)
    expect(archived.lastUpdatedAt).toBe(500)
  })

  it('preserves other fields', () => {
    const litter = createLitter({ id: 'x', name: 'Test', now: 100 })
    const archived = archiveLitter(litter, 500)
    expect(archived.id).toBe(litter.id)
    expect(archived.name).toBe(litter.name)
  })

  it('is idempotent in active state but bumps lastUpdatedAt', () => {
    const litter = createLitter({ id: 'x', name: 'Test', now: 100 })
    const once = archiveLitter(litter, 200)
    const twice = archiveLitter(once, 300)
    expect(twice.active).toBe(false)
    expect(twice.lastUpdatedAt).toBe(300)
  })

  it('does not mutate the input', () => {
    const litter = createLitter({ id: 'x', name: 'Test', now: 100 })
    archiveLitter(litter, 200)
    expect(litter.active).toBe(true)
    expect(litter.lastUpdatedAt).toBe(100)
  })
})

describe('activateLitter', () => {
  it('sets active to true and updates lastUpdatedAt', () => {
    const archived = archiveLitter(
      createLitter({ id: 'x', name: 'Test', now: 100 }),
      200,
    )
    const restored = activateLitter(archived, 300)
    expect(restored.active).toBe(true)
    expect(restored.lastUpdatedAt).toBe(300)
  })

  it('is idempotent in active state but bumps lastUpdatedAt', () => {
    const litter = createLitter({ id: 'x', name: 'Test', now: 100 })
    const once = activateLitter(litter, 200)
    const twice = activateLitter(once, 300)
    expect(twice.active).toBe(true)
    expect(twice.lastUpdatedAt).toBe(300)
  })
})

describe('renameLitter', () => {
  it('changes the name and updates lastUpdatedAt', () => {
    const litter = createLitter({ id: 'x', name: 'Old', now: 100 })
    const renamed = renameLitter(litter, 'New', 200)
    expect(renamed.name).toBe('New')
    expect(renamed.lastUpdatedAt).toBe(200)
  })

  it('trims whitespace from the new name', () => {
    const litter = createLitter({ id: 'x', name: 'Old', now: 100 })
    expect(renameLitter(litter, '  New  ', 200).name).toBe('New')
  })

  it('preserves other fields', () => {
    const litter = createLitter({ id: 'x', name: 'Old', now: 100 })
    const renamed = renameLitter(litter, 'New', 200)
    expect(renamed.id).toBe(litter.id)
    expect(renamed.active).toBe(litter.active)
  })
})

describe('validateLitterName', () => {
  it('accepts a normal name', () => {
    const result = validateLitterName('Test Litter')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects an empty string', () => {
    const result = validateLitterName('')
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('rejects whitespace-only', () => {
    const result = validateLitterName('   ')
    expect(result.valid).toBe(false)
  })

  it('rejects names over 100 characters', () => {
    const result = validateLitterName('x'.repeat(101))
    expect(result.valid).toBe(false)
  })

  it('accepts names exactly 100 characters', () => {
    const result = validateLitterName('x'.repeat(100))
    expect(result.valid).toBe(true)
  })

  it('counts length after trimming', () => {
    const result = validateLitterName('  ' + 'x'.repeat(100) + '  ')
    expect(result.valid).toBe(true)
  })
})

describe('NullLitter', () => {
  it('has empty id', () => {
    expect(NullLitter.id).toBe('')
  })

  it('has displayable fallback name', () => {
    expect(NullLitter.name).toBe('Unknown')
  })

  it('is not active', () => {
    expect(NullLitter.active).toBe(false)
  })

  it('has lastUpdatedAt of 0', () => {
    expect(NullLitter.lastUpdatedAt).toBe(0)
  })

  it('is consumable by Litter functions (Liskov substitutability)', () => {
    const archived = archiveLitter(NullLitter, 1000)
    const activated = activateLitter(NullLitter, 1000)
    const renamed = renameLitter(NullLitter, 'Anything', 1000)
    expect(archived.active).toBe(false)
    expect(activated.active).toBe(true)
    expect(renamed.name).toBe('Anything')
  })

  it('satisfies the Litter interface', () => {
    const asLitter: Litter = NullLitter
    expect(asLitter).toBeDefined()
  })
})
