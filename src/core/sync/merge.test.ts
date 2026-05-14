import { describe, it, expect } from 'vitest'
import {
  mergeEntities,
  mergeSettings,
  mergeSnapshots,
  deepEqual,
} from './index'

interface TestEntity {
  readonly id: string
  readonly lastUpdatedAt: number
  readonly name: string
}

function e(id: string, lastUpdatedAt: number, name: string): TestEntity {
  return { id, lastUpdatedAt, name }
}

describe('deepEqual', () => {
  it('returns true for identical primitives', () => {
    expect(deepEqual(1, 1)).toBe(true)
    expect(deepEqual('a', 'a')).toBe(true)
    expect(deepEqual(true, true)).toBe(true)
    expect(deepEqual(null, null)).toBe(true)
  })

  it('returns false for different primitives', () => {
    expect(deepEqual(1, 2)).toBe(false)
    expect(deepEqual('a', 'b')).toBe(false)
    expect(deepEqual(null, undefined)).toBe(false)
  })

  it('returns true for structurally identical objects', () => {
    expect(deepEqual({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBe(true)
  })

  it('returns false for objects with different values', () => {
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false)
  })

  it('returns false for objects with different keys', () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
  })

  it('returns true for identical arrays', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true)
  })

  it('returns false for arrays of different length', () => {
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false)
  })

  it('returns false comparing array to object with same numeric keys', () => {
    expect(deepEqual([1, 2], { 0: 1, 1: 2 })).toBe(false)
  })

  it('handles nested structures', () => {
    expect(
      deepEqual({ a: [1, { b: 'x' }] }, { a: [1, { b: 'x' }] }),
    ).toBe(true)
    expect(
      deepEqual({ a: [1, { b: 'x' }] }, { a: [1, { b: 'y' }] }),
    ).toBe(false)
  })
})

describe('mergeEntities — empty cases', () => {
  it('empty local + empty remote → empty merged, no conflicts', () => {
    const result = mergeEntities<TestEntity>([], [])
    expect(result.merged).toEqual([])
    expect(result.conflicts).toEqual([])
  })

  it('local has entries + empty remote → all local kept', () => {
    const local = [e('a', 100, 'Sage'), e('b', 200, 'Basil')]
    const result = mergeEntities(local, [])
    expect(result.merged).toEqual(local)
    expect(result.conflicts).toEqual([])
  })

  it('empty local + remote has entries → all remote taken', () => {
    const remote = [e('a', 100, 'Sage'), e('b', 200, 'Basil')]
    const result = mergeEntities<TestEntity>([], remote)
    expect(result.merged).toEqual(remote)
    expect(result.conflicts).toEqual([])
  })
})

describe('mergeEntities — disjoint sets', () => {
  it('union of disjoint local + remote', () => {
    const local = [e('a', 100, 'Sage')]
    const remote = [e('b', 200, 'Basil')]
    const result = mergeEntities(local, remote)
    expect(result.merged).toHaveLength(2)
    expect(result.merged).toContainEqual(local[0])
    expect(result.merged).toContainEqual(remote[0])
    expect(result.conflicts).toEqual([])
  })
})

describe('mergeEntities — timestamp comparison', () => {
  it('local newer wins', () => {
    const local = [e('a', 200, 'NewSage')]
    const remote = [e('a', 100, 'OldSage')]
    const result = mergeEntities(local, remote)
    expect(result.merged).toEqual(local)
    expect(result.conflicts).toEqual([])
  })

  it('remote newer wins', () => {
    const local = [e('a', 100, 'OldSage')]
    const remote = [e('a', 200, 'NewSage')]
    const result = mergeEntities(local, remote)
    expect(result.merged).toEqual(remote)
    expect(result.conflicts).toEqual([])
  })
})

describe('mergeEntities — tie cases', () => {
  it('equal timestamps + identical content → no conflict', () => {
    const local = [e('a', 100, 'Sage')]
    const remote = [e('a', 100, 'Sage')]
    const result = mergeEntities(local, remote)
    expect(result.merged).toEqual(local)
    expect(result.conflicts).toEqual([])
  })

  it('equal timestamps + different content → conflict; local wins merged', () => {
    const local = [e('a', 100, 'LocalSage')]
    const remote = [e('a', 100, 'RemoteSage')]
    const result = mergeEntities(local, remote)
    expect(result.merged).toEqual(local)
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0]?.id).toBe('a')
    expect(result.conflicts[0]?.local).toEqual(local[0])
    expect(result.conflicts[0]?.remote).toEqual(remote[0])
  })
})

describe('mergeEntities — mixed scenarios', () => {
  it('handles many entities with mixed conditions', () => {
    const local = [
      e('only-local', 50, 'OnlyLocal'),
      e('local-newer', 300, 'LocalNewer'),
      e('remote-newer', 100, 'LocalLoses'),
      e('tie-same', 150, 'TieSame'),
      e('tie-diff', 200, 'LocalConflict'),
    ]
    const remote = [
      e('only-remote', 75, 'OnlyRemote'),
      e('local-newer', 200, 'RemoteLoses'),
      e('remote-newer', 250, 'RemoteWins'),
      e('tie-same', 150, 'TieSame'),
      e('tie-diff', 200, 'RemoteConflict'),
    ]
    const result = mergeEntities(local, remote)

    expect(result.merged).toHaveLength(6)
    expect(result.merged).toContainEqual(local[0]) // only-local
    expect(result.merged).toContainEqual(remote[0]) // only-remote
    expect(result.merged).toContainEqual(local[1]) // local-newer (kept)
    expect(result.merged).toContainEqual(remote[2]) // remote-newer (taken)
    expect(result.merged).toContainEqual(local[3]) // tie-same (either)
    expect(result.merged).toContainEqual(local[4]) // tie-diff (local wins)

    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0]?.id).toBe('tie-diff')
  })
})

describe('mergeEntities — custom equals', () => {
  it('uses the equals callback for content comparison on ties', () => {
    const local = [e('a', 100, 'Sage')]
    const remote = [e('a', 100, 'sage')]
    // Treat case-insensitively
    const ciEquals = (x: TestEntity, y: TestEntity) =>
      x.id === y.id &&
      x.lastUpdatedAt === y.lastUpdatedAt &&
      x.name.toLowerCase() === y.name.toLowerCase()
    const result = mergeEntities(local, remote, ciEquals)
    expect(result.conflicts).toEqual([])
  })
})

describe('mergeSettings', () => {
  it('keeps local when newer', () => {
    const local = { stickyLitterId: 'L1', lastUpdatedAt: 200 }
    const remote = { stickyLitterId: 'L2', lastUpdatedAt: 100 }
    const result = mergeSettings(local, remote)
    expect(result.merged).toEqual(local)
    expect(result.conflict).toBe(null)
  })

  it('takes remote when newer', () => {
    const local = { stickyLitterId: 'L1', lastUpdatedAt: 100 }
    const remote = { stickyLitterId: 'L2', lastUpdatedAt: 200 }
    const result = mergeSettings(local, remote)
    expect(result.merged).toEqual(remote)
    expect(result.conflict).toBe(null)
  })

  it('reports conflict on tie with different content', () => {
    const local = { stickyLitterId: 'L1', lastUpdatedAt: 100 }
    const remote = { stickyLitterId: 'L2', lastUpdatedAt: 100 }
    const result = mergeSettings(local, remote)
    expect(result.merged).toEqual(local)
    expect(result.conflict).not.toBe(null)
    expect(result.conflict?.local).toEqual(local)
    expect(result.conflict?.remote).toEqual(remote)
  })

  it('no conflict on tie with identical content', () => {
    const local = { stickyLitterId: 'L1', lastUpdatedAt: 100 }
    const remote = { stickyLitterId: 'L1', lastUpdatedAt: 100 }
    const result = mergeSettings(local, remote)
    expect(result.conflict).toBe(null)
  })
})

describe('mergeSnapshots', () => {
  it('merges all entity collections end-to-end', () => {
    const local = {
      settings: { stickyLitterId: 'L1', lastUpdatedAt: 100 },
      litters: [
        {
          id: 'L1',
          name: 'LocalLitter',
          active: true,
          lastUpdatedAt: 200,
        },
      ],
      kittens: [],
      feedingSessions: [],
      weightEntries: [],
    }
    const remote = {
      schemaVersion: 1,
      settings: { stickyLitterId: 'L2', lastUpdatedAt: 50 },
      litters: [
        {
          id: 'L1',
          name: 'RemoteLitter',
          active: true,
          lastUpdatedAt: 100,
        },
        {
          id: 'L2',
          name: 'OnlyRemote',
          active: true,
          lastUpdatedAt: 75,
        },
      ],
      kittens: [],
      feedingSessions: [],
      weightEntries: [],
    }
    const result = mergeSnapshots(local, remote)
    expect(result.merged.settings).toEqual(local.settings) // local newer
    expect(result.merged.litters).toHaveLength(2)
    expect(
      result.merged.litters.find((l) => l.id === 'L1')?.name,
    ).toBe('LocalLitter') // local newer
    expect(result.merged.litters.find((l) => l.id === 'L2')?.name).toBe(
      'OnlyRemote',
    )
    expect(result.conflicts).toEqual([])
  })

  it('aggregates conflicts across entity types', () => {
    const local = {
      settings: { stickyLitterId: 'L1', lastUpdatedAt: 100 },
      litters: [
        {
          id: 'L1',
          name: 'LocalName',
          active: true,
          lastUpdatedAt: 100,
        },
      ],
      kittens: [],
      feedingSessions: [],
      weightEntries: [],
    }
    const remote = {
      schemaVersion: 1,
      settings: { stickyLitterId: 'L2', lastUpdatedAt: 100 }, // tie + diff
      litters: [
        {
          id: 'L1',
          name: 'RemoteName',
          active: true,
          lastUpdatedAt: 100,
        }, // tie + diff
      ],
      kittens: [],
      feedingSessions: [],
      weightEntries: [],
    }
    const result = mergeSnapshots(local, remote)
    expect(result.conflicts.length).toBeGreaterThanOrEqual(2)
    const types = result.conflicts.map((c) => c.entityType)
    expect(types).toContain('settings')
    expect(types).toContain('litters')
  })
})
