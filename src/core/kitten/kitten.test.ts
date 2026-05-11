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
  }
}

describe('createKitten', () => {
  it('returns a kitten with the given id, litterId, displayName, and order, active by default', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: 'Mittens',
      order: 0,
    })
    expect(kitten).toEqual({
      id: 'k1',
      litterId: 'L1',
      displayName: 'Mittens',
      active: true,
      order: 0,
    })
  })

  it('trims whitespace from the display name', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: '  Mittens  ',
      order: 0,
    })
    expect(kitten.displayName).toBe('Mittens')
  })

  it('preserves the order parameter exactly', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: 'M',
      order: 7,
    })
    expect(kitten.order).toBe(7)
  })
})

describe('archiveKitten', () => {
  it('sets active to false', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: 'M',
      order: 0,
    })
    expect(archiveKitten(kitten).active).toBe(false)
  })

  it('preserves other fields including order', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: 'M',
      order: 3,
    })
    const archived = archiveKitten(kitten)
    expect(archived.id).toBe(kitten.id)
    expect(archived.litterId).toBe(kitten.litterId)
    expect(archived.displayName).toBe(kitten.displayName)
    expect(archived.order).toBe(3)
  })

  it('is idempotent', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: 'M',
      order: 0,
    })
    expect(archiveKitten(archiveKitten(kitten))).toEqual(archiveKitten(kitten))
  })

  it('does not mutate the input', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: 'M',
      order: 0,
    })
    archiveKitten(kitten)
    expect(kitten.active).toBe(true)
  })
})

describe('activateKitten', () => {
  it('sets active to true', () => {
    const archived = archiveKitten(
      createKitten({ id: 'k1', litterId: 'L1', displayName: 'M', order: 0 }),
    )
    expect(activateKitten(archived).active).toBe(true)
  })

  it('is idempotent', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: 'M',
      order: 0,
    })
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
      order: 0,
    })
    expect(renameKitten(kitten, 'New').displayName).toBe('New')
  })

  it('trims whitespace', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: 'Old',
      order: 0,
    })
    expect(renameKitten(kitten, '  New  ').displayName).toBe('New')
  })

  it('preserves litterId and order', () => {
    const kitten = createKitten({
      id: 'k1',
      litterId: 'L1',
      displayName: 'Old',
      order: 5,
    })
    const renamed = renameKitten(kitten, 'New')
    expect(renamed.litterId).toBe('L1')
    expect(renamed.order).toBe(5)
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
