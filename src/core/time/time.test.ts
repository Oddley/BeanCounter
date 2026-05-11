import { describe, it, expect } from 'vitest'
import {
  startOfLocalDay,
  isSameLocalDay,
  localDayKey,
  addDays,
  localDayDiff,
} from './index'

// Helper: build a local-time millis value from y/m/d/h/m components.
function local(
  y: number,
  m: number,
  d: number,
  hh = 0,
  mm = 0,
  ss = 0,
): number {
  return new Date(y, m - 1, d, hh, mm, ss).getTime()
}

describe('startOfLocalDay', () => {
  it('returns midnight local time of the same day', () => {
    const input = local(2026, 5, 15, 14, 30, 45)
    const result = startOfLocalDay(input)
    const expected = local(2026, 5, 15, 0, 0, 0)
    expect(result).toBe(expected)
  })

  it('is idempotent', () => {
    const input = local(2026, 5, 15, 14, 30)
    expect(startOfLocalDay(startOfLocalDay(input))).toBe(
      startOfLocalDay(input),
    )
  })

  it('handles input already at midnight', () => {
    const input = local(2026, 5, 15, 0, 0, 0)
    expect(startOfLocalDay(input)).toBe(input)
  })
})

describe('isSameLocalDay', () => {
  it('returns true for two times on the same local day', () => {
    expect(
      isSameLocalDay(local(2026, 5, 15, 1, 0), local(2026, 5, 15, 23, 59)),
    ).toBe(true)
  })

  it('returns false for adjacent local days', () => {
    expect(
      isSameLocalDay(
        local(2026, 5, 15, 23, 59),
        local(2026, 5, 16, 0, 1),
      ),
    ).toBe(false)
  })

  it('returns true for identical timestamps', () => {
    const t = local(2026, 5, 15, 14, 30)
    expect(isSameLocalDay(t, t)).toBe(true)
  })

  it('matches startOfLocalDay-equality semantics', () => {
    const a = local(2026, 5, 15, 8, 0)
    const b = local(2026, 5, 15, 20, 0)
    expect(isSameLocalDay(a, b)).toBe(
      startOfLocalDay(a) === startOfLocalDay(b),
    )
  })
})

describe('localDayKey', () => {
  it('produces YYYY-MM-DD strings', () => {
    expect(localDayKey(local(2026, 5, 15, 14, 30))).toBe('2026-05-15')
  })

  it('zero-pads single-digit months and days', () => {
    expect(localDayKey(local(2026, 1, 3, 0, 0))).toBe('2026-01-03')
  })

  it('is stable across hours of the same day', () => {
    const morning = localDayKey(local(2026, 5, 15, 1, 0))
    const evening = localDayKey(local(2026, 5, 15, 23, 0))
    expect(morning).toBe(evening)
  })

  it('changes across days', () => {
    expect(localDayKey(local(2026, 5, 15))).not.toBe(
      localDayKey(local(2026, 5, 16)),
    )
  })
})

describe('addDays', () => {
  it('advances by one local day', () => {
    const result = addDays(local(2026, 5, 15, 12, 0), 1)
    expect(localDayKey(result)).toBe('2026-05-16')
  })

  it('advances by multiple days', () => {
    const result = addDays(local(2026, 5, 15, 12, 0), 7)
    expect(localDayKey(result)).toBe('2026-05-22')
  })

  it('accepts negative offsets', () => {
    const result = addDays(local(2026, 5, 15, 12, 0), -1)
    expect(localDayKey(result)).toBe('2026-05-14')
  })

  it('addDays(x, 0) returns the same millis', () => {
    const x = local(2026, 5, 15, 12, 0)
    expect(addDays(x, 0)).toBe(x)
  })

  it('preserves time-of-day across the offset', () => {
    const x = local(2026, 5, 15, 14, 30)
    const advanced = addDays(x, 3)
    const xDate = new Date(x)
    const adv = new Date(advanced)
    expect(adv.getHours()).toBe(xDate.getHours())
    expect(adv.getMinutes()).toBe(xDate.getMinutes())
  })
})

describe('localDayDiff', () => {
  it('returns 0 for same local day', () => {
    expect(
      localDayDiff(local(2026, 5, 15, 23, 0), local(2026, 5, 15, 1, 0)),
    ).toBe(0)
  })

  it('returns 1 for adjacent days', () => {
    expect(
      localDayDiff(local(2026, 5, 16, 0, 1), local(2026, 5, 15, 23, 59)),
    ).toBe(1)
  })

  it('returns 7 for one week apart', () => {
    expect(
      localDayDiff(local(2026, 5, 22, 12, 0), local(2026, 5, 15, 12, 0)),
    ).toBe(7)
  })

  it('returns negative when later precedes earlier', () => {
    expect(
      localDayDiff(local(2026, 5, 10, 12, 0), local(2026, 5, 15, 12, 0)),
    ).toBe(-5)
  })
})
