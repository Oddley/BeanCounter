import { describe, it, expect } from 'vitest'
import {
  createKitten,
  archiveKitten,
  activateKitten,
  renameKitten,
  validateKittenName,
  defaultKittenName,
  reassignOrders,
  moveKittenUp,
  moveKittenDown,
  NullKitten,
  type Kitten,
} from './index'

function k(id: string, order: number, active = true): Kitten {
  return {
    id,
    litterId: 'L1',
    displayName: id,
    active,
    order,
    lastUpdatedAt: 0,
  }
}

describe('createKitten', () => {
  it('returns a kitten with the given id, litterId, displayName, order, and lastUpdatedAt; active by default', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: 'Mittens',
      order: 0,
      now: 1000,
    })
    expect(kitten).toEqual({
      id: 'k1',
      litterId: 'L1',
      displayName: 'Mittens',
      active: true,
      order: 0,
      lastUpdatedAt: 1000,
    })
  })

  it('trims whitespace from the display name', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: '  Mittens  ',
      order: 0,
      now: 0,
    })
    expect(kitten.displayName).toBe('Mittens')
  })

  it('preserves the order parameter exactly', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: 'M',
      order: 7,
      now: 0,
    })
    expect(kitten.order).toBe(7)
  })

  it('sets lastUpdatedAt from now', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: 'M',
      order: 0,
      now: 42,
    })
    expect(kitten.lastUpdatedAt).toBe(42)
  })
})

describe('archiveKitten', () => {
  it('sets active to false and bumps lastUpdatedAt', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: 'M',
      order: 0,
      now: 100,
    })
    const archived = archiveKitten(kitten, 500)
    expect(archived.active).toBe(false)
    expect(archived.lastUpdatedAt).toBe(500)
  })

  it('preserves other fields', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: 'M',
      order: 3,
      now: 100,
    })
    const archived = archiveKitten(kitten, 500)
    expect(archived.id).toBe(kitten.id)
    expect(archived.litterId).toBe(kitten.litterId)
    expect(archived.displayName).toBe(kitten.displayName)
    expect(archived.order).toBe(3)
  })

  it('does not mutate the input', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: 'M',
      order: 0,
      now: 100,
    })
    archiveKitten(kitten, 500)
    expect(kitten.active).toBe(true)
    expect(kitten.lastUpdatedAt).toBe(100)
  })
})

describe('activateKitten', () => {
  it('sets active to true and bumps lastUpdatedAt', () => {
    const archived = archiveKitten(
      createKitten({
        id: 'k1',
        litterId: 'L1',
        displayName: 'M',
        order: 0,
        now: 100,
      }),
      200,
    )
    const restored = activateKitten(archived, 300)
    expect(restored.active).toBe(true)
    expect(restored.lastUpdatedAt).toBe(300)
  })
})

describe('renameKitten', () => {
  it('changes the display name and bumps lastUpdatedAt', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: 'Old',
      order: 0,
      now: 100,
    })
    const renamed = renameKitten(kitten, 'New', 200)
    expect(renamed.displayName).toBe('New')
    expect(renamed.lastUpdatedAt).toBe(200)
  })

  it('trims whitespace', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: 'Old',
      order: 0,
      now: 0,
    })
    expect(renameKitten(kitten, '  New  ', 100).displayName).toBe('New')
  })

  it('preserves litterId', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: 'Old',
      order: 0,
      now: 0,
    })
    expect(renameKitten(kitten, 'New', 100).litterId).toBe('L1')
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

describe('reassignOrders', () => {
  it('assigns 0..n-1 to the array in given order', () => {
    const input = [k('a', 99), k('b', 5), k('c', 0)]
    const result = reassignOrders(input)
    expect(result.map((x) => x.id)).toEqual(['a', 'b', 'c'])
    expect(result.map((x) => x.order)).toEqual([0, 1, 2])
  })

  it('returns an empty array for empty input', () => {
    expect(reassignOrders([])).toEqual([])
  })

  it('does not mutate the input', () => {
    const input = [k('a', 99), k('b', 5)]
    const snapshot = [{ ...input[0] }, { ...input[1] }]
    reassignOrders(input)
    expect(input).toEqual(snapshot)
  })

  it('preserves all fields other than order', () => {
    const input = [k('a', 99)]
    const result = reassignOrders(input)
    expect(result[0]?.id).toBe('a')
    expect(result[0]?.displayName).toBe('a')
    expect(result[0]?.litterId).toBe('L1')
    expect(result[0]?.active).toBe(true)
  })
})

describe('moveKittenUp', () => {
  it('swaps with previous and reassigns orders', () => {
    const input = [k('a', 0), k('b', 1), k('c', 2)]
    const result = moveKittenUp(input, 2)
    expect(result.map((x) => x.id)).toEqual(['a', 'c', 'b'])
    expect(result.map((x) => x.order)).toEqual([0, 1, 2])
  })

  it('is a no-op when index is 0', () => {
    const input = [k('a', 0), k('b', 1)]
    const result = moveKittenUp(input, 0)
    expect(result.map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('is a no-op when index is out of range', () => {
    const input = [k('a', 0), k('b', 1)]
    const result = moveKittenUp(input, 99)
    expect(result.map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('does not mutate the input', () => {
    const input = [k('a', 0), k('b', 1)]
    moveKittenUp(input, 1)
    expect(input.map((x) => x.id)).toEqual(['a', 'b'])
  })
})

describe('moveKittenDown', () => {
  it('swaps with next and reassigns orders', () => {
    const input = [k('a', 0), k('b', 1), k('c', 2)]
    const result = moveKittenDown(input, 0)
    expect(result.map((x) => x.id)).toEqual(['b', 'a', 'c'])
    expect(result.map((x) => x.order)).toEqual([0, 1, 2])
  })

  it('is a no-op when index is last', () => {
    const input = [k('a', 0), k('b', 1)]
    const result = moveKittenDown(input, 1)
    expect(result.map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('is a no-op when index is out of range', () => {
    const input = [k('a', 0), k('b', 1)]
    const result = moveKittenDown(input, -1)
    expect(result.map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('does not mutate the input', () => {
    const input = [k('a', 0), k('b', 1)]
    moveKittenDown(input, 0)
    expect(input.map((x) => x.id)).toEqual(['a', 'b'])
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

  it('has order 0', () => {
    expect(NullKitten.order).toBe(0)
  })

  it('has lastUpdatedAt of 0', () => {
    expect(NullKitten.lastUpdatedAt).toBe(0)
  })

  it('is consumable by Kitten functions (Liskov substitutability)', () => {
    const archived = archiveKitten(NullKitten, 1000)
    const renamed = renameKitten(NullKitten, 'Anything', 1000)
    expect(archived.active).toBe(false)
    expect(renamed.displayName).toBe('Anything')
  })

  it('satisfies the Kitten interface', () => {
    const asKitten: Kitten = NullKitten
    expect(asKitten).toBeDefined()
  })
})
