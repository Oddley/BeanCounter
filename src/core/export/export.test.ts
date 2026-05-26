import { describe, it, expect } from 'vitest'
import { buildCsv } from './export'

const kittens = [
  { id: 'k1', displayName: 'Luna', order: 0 },
  { id: 'k2', displayName: 'Nova', order: 1 },
]

const sessions = [
  { id: 's1', createdAt: 1_000_000, recordedAt: 0 },
  { id: 's2', createdAt: 2_000_000, recordedAt: 0 },
]

const entries = [
  { sessionId: 's1', kittenId: 'k1', grams: 100 },
  { sessionId: 's1', kittenId: 'k2', grams: 80 },
  { sessionId: 's2', kittenId: 'k1', grams: 110 },
  // Nova intentionally missing from s2
]

function rows(csv: string) {
  return csv.split('\r\n')
}

describe('buildCsv', () => {
  it('produces the right row count (header + kittens + gap + header + kittens)', () => {
    // 1 grams header + 2 kitten rows + 1 gap + 1 ounces header + 2 kitten rows = 7
    expect(rows(buildCsv({ kittens, sessions, entries }))).toHaveLength(7)
  })

  it('grams header row starts with "Grams"', () => {
    expect(rows(buildCsv({ kittens, sessions, entries }))[0]).toMatch(/^Grams,/)
  })

  it('kitten gram values appear in correct columns', () => {
    const r = rows(buildCsv({ kittens, sessions, entries }))
    expect(r[1]).toMatch(/^Luna,100,110/)
    expect(r[2]).toMatch(/^Nova,80,/)
  })

  it('empty cell for a kitten missing from a session', () => {
    const r = rows(buildCsv({ kittens, sessions, entries }))
    expect(r[2]).toBe('Nova,80,')
  })

  it('gap row is empty', () => {
    expect(rows(buildCsv({ kittens, sessions, entries }))[3]).toBe('')
  })

  it('ounces header row starts with "Ounces"', () => {
    expect(rows(buildCsv({ kittens, sessions, entries }))[4]).toMatch(/^Ounces,/)
  })

  it('grams and ounces share the same session column headers', () => {
    const r = rows(buildCsv({ kittens, sessions, entries }))
    const gramsHeaders = r[0]?.split(',').slice(1)
    const ouncesHeaders = r[4]?.split(',').slice(1)
    expect(gramsHeaders).toEqual(ouncesHeaders)
  })

  it('ounces conversion rounds to 2 decimal places', () => {
    // 100g × 0.035274 = 3.5274 → 3.53
    // 110g × 0.035274 = 3.88014 → 3.88
    const r = rows(buildCsv({ kittens, sessions, entries }))
    expect(r[5]).toMatch(/^Luna,3\.53,3\.88/)
  })

  it('empty ounces cell mirrors empty grams cell', () => {
    const r = rows(buildCsv({ kittens, sessions, entries }))
    expect(r[6]).toBe('Nova,2.82,')
  })

  it('sessions are sorted chronologically regardless of input order', () => {
    const shuffled = { kittens, sessions: [sessions[1], sessions[0]] as typeof sessions, entries }
    expect(buildCsv({ kittens, sessions, entries })).toBe(buildCsv(shuffled))
  })

  it('kittens are sorted by order regardless of input order', () => {
    const shuffled = { sessions, entries, kittens: [kittens[1], kittens[0]] as typeof kittens }
    const r = rows(buildCsv(shuffled))
    expect(r[1]).toMatch(/^Luna,/)
    expect(r[2]).toMatch(/^Nova,/)
  })

  it('CSV-escapes kitten names containing commas', () => {
    const csv = buildCsv({
      kittens: [{ id: 'k1', displayName: 'Luna, Jr', order: 0 }],
      sessions,
      entries: [{ sessionId: 's1', kittenId: 'k1', grams: 100 }],
    })
    expect(rows(csv)[1]).toMatch(/^"Luna, Jr",/)
  })

  it('CSV-escapes kitten names containing double quotes', () => {
    const csv = buildCsv({
      kittens: [{ id: 'k1', displayName: 'Luna "Star"', order: 0 }],
      sessions,
      entries: [{ sessionId: 's1', kittenId: 'k1', grams: 100 }],
    })
    expect(rows(csv)[1]).toMatch(/^"Luna ""Star""",/)
  })

  it('recordedAt overrides createdAt for session column ordering', () => {
    // s1 has createdAt=1 but recordedAt=5 (later than s2's createdAt=2)
    const overrideSessions = [
      { id: 's1', createdAt: 1_000_000, recordedAt: 5_000_000 },
      { id: 's2', createdAt: 2_000_000, recordedAt: 0 },
    ]
    const overrideEntries = [
      { sessionId: 's1', kittenId: 'k1', grams: 999 },
      { sessionId: 's2', kittenId: 'k1', grams: 111 },
    ]
    const r = rows(buildCsv({ kittens, sessions: overrideSessions, entries: overrideEntries }))
    // s2 (effectiveTime=2M) should come first, s1 (effectiveTime=5M) second
    expect(r[1]).toBe('Luna,111,999')
  })

  it('returns minimal valid CSV for empty input', () => {
    const csv = buildCsv({ kittens: [], sessions: [], entries: [] })
    const r = rows(csv)
    // No kitten rows → grams header, gap, ounces header
    expect(r[0]).toBe('Grams')
    expect(r[1]).toBe('')
    expect(r[2]).toBe('Ounces')
  })
})
