import { describe, it, expect } from 'vitest'
import {
  snapshotToJson,
  parseActiveFile,
  CURRENT_SCHEMA_VERSION,
  type ActiveFile,
} from './index'

function emptySnapshot() {
  return {
    settings: { stickyLitterId: '', lastUpdatedAt: 0 },
    litters: [],
    kittens: [],
    feedingSessions: [],
    weightEntries: [],
  }
}

describe('snapshotToJson', () => {
  it('produces JSON with schemaVersion set to current', () => {
    const json = snapshotToJson(emptySnapshot())
    const parsed = JSON.parse(json) as { schemaVersion: number }
    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
  })

  it('includes all entity collections', () => {
    const snapshot = {
      settings: { stickyLitterId: 'L1', lastUpdatedAt: 100 },
      litters: [
        { id: 'L1', name: 'Test', active: true, lastUpdatedAt: 100 },
      ],
      kittens: [
        {
          id: 'K1',
          displayName: 'Sage',
          litterId: 'L1',
          active: true,
          order: 0,
          lastUpdatedAt: 100,
        },
      ],
      feedingSessions: [],
      weightEntries: [],
    }
    const json = snapshotToJson(snapshot)
    const parsed = JSON.parse(json) as ActiveFile
    expect(parsed.litters).toHaveLength(1)
    expect(parsed.kittens).toHaveLength(1)
    expect(parsed.settings.stickyLitterId).toBe('L1')
  })

  it('produces valid JSON', () => {
    const json = snapshotToJson(emptySnapshot())
    expect(() => JSON.parse(json)).not.toThrow()
  })
})

describe('parseActiveFile', () => {
  it('round-trips a snapshot', () => {
    const snapshot = {
      settings: { stickyLitterId: 'L1', lastUpdatedAt: 100 },
      litters: [{ id: 'L1', name: 'Test', active: true, lastUpdatedAt: 100 }],
      kittens: [
        {
          id: 'K1',
          displayName: 'Sage',
          litterId: 'L1',
          active: true,
          order: 0,
          lastUpdatedAt: 100,
        },
      ],
      feedingSessions: [],
      weightEntries: [],
    }
    const json = snapshotToJson(snapshot)
    const result = parseActiveFile(json)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.file.litters).toEqual(snapshot.litters)
      expect(result.file.kittens).toEqual(snapshot.kittens)
      expect(result.file.settings).toEqual(snapshot.settings)
    }
  })

  it('rejects malformed JSON', () => {
    const result = parseActiveFile('not json {')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/JSON/i)
    }
  })

  it('rejects non-object root', () => {
    const result = parseActiveFile('"a string"')
    expect(result.ok).toBe(false)
  })

  it('rejects missing schemaVersion', () => {
    const result = parseActiveFile(
      JSON.stringify({ litters: [], kittens: [] }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/schemaVersion/i)
    }
  })

  it('rejects newer schemaVersion (refuses forward-overwrite)', () => {
    const result = parseActiveFile(
      JSON.stringify({
        schemaVersion: CURRENT_SCHEMA_VERSION + 1,
        settings: { stickyLitterId: '', lastUpdatedAt: 0 },
        litters: [],
        kittens: [],
        feedingSessions: [],
        weightEntries: [],
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/newer/i)
    }
  })

  it('rejects older schemaVersion (no legacy upgrade in Phase 4)', () => {
    const result = parseActiveFile(
      JSON.stringify({
        schemaVersion: 0,
        settings: { stickyLitterId: '', lastUpdatedAt: 0 },
        litters: [],
        kittens: [],
        feedingSessions: [],
        weightEntries: [],
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/(older|legacy)/i)
    }
  })

  it('accepts current schemaVersion', () => {
    const result = parseActiveFile(
      JSON.stringify({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        settings: { stickyLitterId: '', lastUpdatedAt: 0 },
        litters: [],
        kittens: [],
        feedingSessions: [],
        weightEntries: [],
      }),
    )
    expect(result.ok).toBe(true)
  })

  it('defaults missing collections to empty arrays', () => {
    const result = parseActiveFile(
      JSON.stringify({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        settings: { stickyLitterId: '', lastUpdatedAt: 0 },
      }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.file.litters).toEqual([])
      expect(result.file.kittens).toEqual([])
      expect(result.file.feedingSessions).toEqual([])
      expect(result.file.weightEntries).toEqual([])
    }
  })
})
