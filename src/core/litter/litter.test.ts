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
  it('returns a litter with the given id and name, active by default', () => {
    const litter = createLitter({ id: 'abc-123', name: 'Test Litter' })
    expect(litter).toEqual({
      id: 'abc-123',
      name: 'Test Litter',
      active: true,
      sheetTabId: '',
    })
  })

  it('trims whitespace from the name', () => {
    const litter = createLitter({ id: 'x', name: '  Padded  ' })
    expect(litter.name).toBe('Padded')
  })
})

describe('archiveLitter', () => {
  it('sets active to false', () => {
    const litter = createLitter({ id: 'x', name: 'Test' })
    expect(archiveLitter(litter).active).toBe(false)
  })

  it('preserves other fields', () => {
    const litter = createLitter({ id: 'x', name: 'Test' })
    const archived = archiveLitter(litter)
    expect(archived.id).toBe(litter.id)
    expect(archived.name).toBe(litter.name)
    expect(archived.sheetTabId).toBe(litter.sheetTabId)
  })

  it('is idempotent', () => {
    const litter = createLitter({ id: 'x', name: 'Test' })
    expect(archiveLitter(archiveLitter(litter))).toEqual(archiveLitter(litter))
  })

  it('does not mutate the input', () => {
    const litter = createLitter({ id: 'x', name: 'Test' })
    archiveLitter(litter)
    expect(litter.active).toBe(true)
  })
})

describe('activateLitter', () => {
  it('sets active to true', () => {
    const archived = archiveLitter(createLitter({ id: 'x', name: 'Test' }))
    expect(activateLitter(archived).active).toBe(true)
  })

  it('is idempotent', () => {
    const litter = createLitter({ id: 'x', name: 'Test' })
    expect(activateLitter(activateLitter(litter))).toEqual(
      activateLitter(litter),
    )
  })
})

describe('renameLitter', () => {
  it('changes the name', () => {
    const litter = createLitter({ id: 'x', name: 'Old' })
    expect(renameLitter(litter, 'New').name).toBe('New')
  })

  it('trims whitespace from the new name', () => {
    const litter = createLitter({ id: 'x', name: 'Old' })
    expect(renameLitter(litter, '  New  ').name).toBe('New')
  })

  it('preserves other fields', () => {
    const litter = createLitter({ id: 'x', name: 'Old' })
    const renamed = renameLitter(litter, 'New')
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

  it('has empty sheetTabId', () => {
    expect(NullLitter.sheetTabId).toBe('')
  })

  it('is consumable by Litter functions (Liskov substitutability)', () => {
    const archived = archiveLitter(NullLitter)
    const activated = activateLitter(NullLitter)
    const renamed = renameLitter(NullLitter, 'Anything')
    expect(archived.active).toBe(false)
    expect(activated.active).toBe(true)
    expect(renamed.name).toBe('Anything')
  })

  it('satisfies the Litter interface', () => {
    const asLitter: Litter = NullLitter
    expect(asLitter).toBeDefined()
  })
})
