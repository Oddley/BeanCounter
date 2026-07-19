import { describe, it, expect } from 'vitest'
import {
  buildSeries,
  rollingGainPerDay,
  yAxisRange,
  xAxisRange,
  resolveSeriesColors,
  KITTEN_COLOR_PALETTE,
  type KittenSeries,
} from './index'
import { type Kitten } from '../kitten'
import { type FeedingSession } from '../session'
import { type WeightEntry } from '../weight'

function kitten(
  id: string,
  displayName: string,
  order: number,
  color = '',
): Kitten {
  return {
    id,
    displayName,
    active: true,
    litterId: 'L1',
    order,
    lastUpdatedAt: 0,
    color,
  }
}

function session(
  id: string,
  recordedAt: number,
  createdAt: number = recordedAt,
): FeedingSession {
  return {
    id,
    litterId: 'L1',
    createdAt,
    lastUpdatedAt: createdAt,
    recordedAt: recordedAt === createdAt ? 0 : recordedAt,
    completed: true,
    lockAcquired: true,
    deleted: false,
  }
}

function entry(
  sessionId: string,
  kittenId: string,
  grams: number,
): WeightEntry {
  return {
    id: `${sessionId}:${kittenId}`,
    sessionId,
    kittenId,
    grams,
    timestamp: 0,
    clientWriteId: 'W',
  }
}

// May 15, 2026 at noon local
function day(d: number, hour = 12): number {
  return new Date(2026, 4, d, hour, 0).getTime()
}

describe('buildSeries — empty inputs', () => {
  it('returns empty array for no kittens', () => {
    const result = buildSeries({
      kittens: [],
      sessions: [],
      weightEntries: [],
      mode: 'rough',
    })
    expect(result).toEqual([])
  })

  it('returns series with empty points for kittens with no entries', () => {
    const result = buildSeries({
      kittens: [kitten('k1', 'A', 0)],
      sessions: [],
      weightEntries: [],
      mode: 'rough',
    })
    expect(result).toEqual([
      { kittenId: 'k1', displayName: 'A', order: 0, points: [], color: '' },
    ])
  })

  it('propagates the kitten color override', () => {
    const result = buildSeries({
      kittens: [kitten('k1', 'A', 0, '#ff0000')],
      sessions: [],
      weightEntries: [],
      mode: 'rough',
    })
    expect(result[0]?.color).toBe('#ff0000')
  })
})

describe('buildSeries — rough mode', () => {
  it('produces one point per entry at the session effectiveRecordedAt', () => {
    const result = buildSeries({
      kittens: [kitten('k1', 'A', 0)],
      sessions: [session('s1', day(1)), session('s2', day(2))],
      weightEntries: [entry('s1', 'k1', 100), entry('s2', 'k1', 110)],
      mode: 'rough',
    })
    expect(result[0]?.points).toEqual([
      { time: day(1), grams: 100 },
      { time: day(2), grams: 110 },
    ])
  })

  it('sorts points by time ascending even if entries arrive out of order', () => {
    const result = buildSeries({
      kittens: [kitten('k1', 'A', 0)],
      sessions: [session('s1', day(5)), session('s2', day(1))],
      weightEntries: [entry('s1', 'k1', 200), entry('s2', 'k1', 100)],
      mode: 'rough',
    })
    expect(result[0]?.points.map((p) => p.grams)).toEqual([100, 200])
  })

  it('skips entries whose session is missing', () => {
    const result = buildSeries({
      kittens: [kitten('k1', 'A', 0)],
      sessions: [],
      weightEntries: [entry('orphan', 'k1', 999)],
      mode: 'rough',
    })
    expect(result[0]?.points).toEqual([])
  })

  it('preserves kitten input order in output', () => {
    const result = buildSeries({
      kittens: [
        kitten('k2', 'B', 1),
        kitten('k1', 'A', 0),
        kitten('k3', 'C', 2),
      ],
      sessions: [],
      weightEntries: [],
      mode: 'rough',
    })
    expect(result.map((s) => s.kittenId)).toEqual(['k2', 'k1', 'k3'])
  })

  it('uses effectiveRecordedAt (recordedAt overrides createdAt when set)', () => {
    const overridden: FeedingSession = {
      ...session('s1', day(2)),
      createdAt: day(1),
      recordedAt: day(5),
    }
    const result = buildSeries({
      kittens: [kitten('k1', 'A', 0)],
      sessions: [overridden],
      weightEntries: [entry('s1', 'k1', 100)],
      mode: 'rough',
    })
    expect(result[0]?.points[0]?.time).toBe(day(5))
  })
})

describe('buildSeries — smooth mode', () => {
  it('averages multiple entries on the same day', () => {
    const result = buildSeries({
      kittens: [kitten('k1', 'A', 0)],
      sessions: [
        session('s1', day(1, 8)),
        session('s2', day(1, 18)),
      ],
      weightEntries: [
        entry('s1', 'k1', 100),
        entry('s2', 'k1', 110),
      ],
      mode: 'smooth',
    })
    expect(result[0]?.points).toHaveLength(1)
    expect(result[0]?.points[0]?.grams).toBe(105)
  })

  it('produces consecutive daily points without interpolation when no gaps', () => {
    const result = buildSeries({
      kittens: [kitten('k1', 'A', 0)],
      sessions: [
        session('s1', day(1)),
        session('s2', day(2)),
        session('s3', day(3)),
      ],
      weightEntries: [
        entry('s1', 'k1', 100),
        entry('s2', 'k1', 110),
        entry('s3', 'k1', 120),
      ],
      mode: 'smooth',
    })
    expect(result[0]?.points).toHaveLength(3)
    expect(result[0]?.points.map((p) => p.grams)).toEqual([100, 110, 120])
  })

  it('linearly interpolates missing days between known points', () => {
    // Day 1: 100g, Day 4: 130g → expect intermediate days 2 and 3
    // Linear: day 2 = 110, day 3 = 120
    const result = buildSeries({
      kittens: [kitten('k1', 'A', 0)],
      sessions: [session('s1', day(1)), session('s2', day(4))],
      weightEntries: [
        entry('s1', 'k1', 100),
        entry('s2', 'k1', 130),
      ],
      mode: 'smooth',
    })
    expect(result[0]?.points).toHaveLength(4)
    expect(result[0]?.points.map((p) => p.grams)).toEqual([
      100, 110, 120, 130,
    ])
  })

  it('returns a single point for a single recorded day (no interpolation possible)', () => {
    const result = buildSeries({
      kittens: [kitten('k1', 'A', 0)],
      sessions: [session('s1', day(1))],
      weightEntries: [entry('s1', 'k1', 100)],
      mode: 'smooth',
    })
    expect(result[0]?.points).toHaveLength(1)
    expect(result[0]?.points[0]?.grams).toBe(100)
  })

  it('handles multiple kittens independently', () => {
    const result = buildSeries({
      kittens: [kitten('k1', 'A', 0), kitten('k2', 'B', 1)],
      sessions: [session('s1', day(1)), session('s2', day(3))],
      weightEntries: [
        entry('s1', 'k1', 100),
        entry('s2', 'k1', 120),
        entry('s1', 'k2', 200),
      ],
      mode: 'smooth',
    })
    expect(result[0]?.points.map((p) => p.grams)).toEqual([100, 110, 120])
    expect(result[1]?.points.map((p) => p.grams)).toEqual([200])
  })
})

describe('yAxisRange', () => {
  function s(points: Array<[number, number]>): KittenSeries {
    return {
      kittenId: 'k',
      displayName: 'A',
      order: 0,
      points: points.map(([time, grams]) => ({ time, grams })),
      color: '',
    }
  }

  it('returns {0, 0} for empty series list', () => {
    expect(yAxisRange([])).toEqual({ min: 0, max: 0 })
  })

  it('returns {0, 0} when all series are empty', () => {
    expect(yAxisRange([s([])])).toEqual({ min: 0, max: 0 })
  })

  it('returns padded range across all series', () => {
    const range = yAxisRange([
      s([
        [0, 100],
        [1, 200],
      ]),
    ])
    expect(range.min).toBeLessThan(100)
    expect(range.max).toBeGreaterThan(200)
  })

  it('pads identical min/max so the chart still renders', () => {
    const range = yAxisRange([s([[0, 100]])])
    expect(range.min).toBeLessThan(100)
    expect(range.max).toBeGreaterThan(100)
  })

  it('considers all kitten series, not just the first', () => {
    const range = yAxisRange([s([[0, 100]]), s([[0, 50]]), s([[0, 200]])])
    expect(range.min).toBeLessThan(50)
    expect(range.max).toBeGreaterThan(200)
  })
})

describe('rollingGainPerDay', () => {
  const HOUR = 60 * 60 * 1000
  const DAY = 24 * HOUR
  const WINDOW = 72 * HOUR
  const now = day(15) // May 15, 2026 at noon

  it('returns null for empty points', () => {
    expect(rollingGainPerDay([], WINDOW, now)).toBeNull()
  })

  it('returns null for a single point in the window', () => {
    const points = [{ time: now - HOUR, grams: 100 }]
    expect(rollingGainPerDay(points, WINDOW, now)).toBeNull()
  })

  it('returns null when all points are outside the window', () => {
    const points = [
      { time: now - 80 * HOUR, grams: 100 },
      { time: now - 73 * HOUR, grams: 110 },
    ]
    expect(rollingGainPerDay(points, WINDOW, now)).toBeNull()
  })

  it('returns null when only one point is inside the window', () => {
    const points = [
      { time: now - 80 * HOUR, grams: 90 },
      { time: now - HOUR, grams: 100 },
    ]
    expect(rollingGainPerDay(points, WINDOW, now)).toBeNull()
  })

  it('returns null when all in-window points share the same timestamp', () => {
    const points = [
      { time: now - HOUR, grams: 100 },
      { time: now - HOUR, grams: 110 },
    ]
    expect(rollingGainPerDay(points, WINDOW, now)).toBeNull()
  })

  it('computes grams/day for two points spanning exactly one day', () => {
    const points = [
      { time: now - DAY, grams: 100 },
      { time: now, grams: 110 },
    ]
    expect(rollingGainPerDay(points, WINDOW, now)).toBeCloseTo(10, 1)
  })

  it('returns a negative value for a losing kitten', () => {
    const points = [
      { time: now - DAY, grams: 120 },
      { time: now, grams: 100 },
    ]
    expect(rollingGainPerDay(points, WINDOW, now)).toBeCloseTo(-20, 1)
  })

  it('excludes points older than the window', () => {
    const points = [
      { time: now - 80 * HOUR, grams: 0 }, // outside — must not skew result
      { time: now - DAY, grams: 100 },
      { time: now, grams: 110 },
    ]
    expect(rollingGainPerDay(points, WINDOW, now)).toBeCloseTo(10, 0)
  })

  it('uses linear regression across multiple in-window points', () => {
    // Perfect linear trend: +10g/day at 0h, 24h, 48h
    const points = [
      { time: now - 2 * DAY, grams: 80 },
      { time: now - DAY, grams: 90 },
      { time: now, grams: 100 },
    ]
    expect(rollingGainPerDay(points, WINDOW, now)).toBeCloseTo(10, 1)
  })
})

describe('xAxisRange', () => {
  function s(points: Array<[number, number]>): KittenSeries {
    return {
      kittenId: 'k',
      displayName: 'A',
      order: 0,
      points: points.map(([time, grams]) => ({ time, grams })),
      color: '',
    }
  }

  it('returns {0, 0} for empty series list', () => {
    expect(xAxisRange([])).toEqual({ min: 0, max: 0 })
  })

  it('returns min and max time across all series', () => {
    const range = xAxisRange([
      s([
        [day(1), 100],
        [day(5), 110],
      ]),
      s([
        [day(3), 200],
        [day(10), 220],
      ]),
    ])
    expect(range.min).toBe(day(1))
    expect(range.max).toBe(day(10))
  })
})

describe('resolveSeriesColors', () => {
  function series(
    kittenId: string,
    order: number,
    color = '',
  ): KittenSeries {
    return { kittenId, displayName: kittenId, order, points: [], color }
  }

  it('returns an empty map for an empty series list', () => {
    expect(resolveSeriesColors([]).size).toBe(0)
  })

  it('assigns palette colors in order to kittens with no override', () => {
    const result = resolveSeriesColors([series('a', 0), series('b', 1)])
    expect(result.get('a')).toBe(KITTEN_COLOR_PALETTE[0])
    expect(result.get('b')).toBe(KITTEN_COLOR_PALETTE[1])
  })

  it('uses the explicit override for a kitten that has one', () => {
    const result = resolveSeriesColors([series('a', 0, '#123456')])
    expect(result.get('a')).toBe('#123456')
  })

  it('skips a palette color already claimed by an earlier override', () => {
    // 'a' overrides to exactly the palette's first color; 'b' (no
    // override) should get the second palette color instead of colliding.
    const result = resolveSeriesColors([
      series('a', 0, KITTEN_COLOR_PALETTE[0]),
      series('b', 1),
    ])
    expect(result.get('a')).toBe(KITTEN_COLOR_PALETTE[0])
    expect(result.get('b')).toBe(KITTEN_COLOR_PALETTE[1])
  })

  it('does not let an override change the default sequence for earlier kittens', () => {
    // 'b' overrides to what would have been 'a's default (palette[0]).
    // Since 'a' is resolved first (left-to-right), it still gets
    // palette[0] — the collision is an accepted edge case, not a bug.
    const result = resolveSeriesColors([
      series('a', 0),
      series('b', 1, KITTEN_COLOR_PALETTE[0]),
    ])
    expect(result.get('a')).toBe(KITTEN_COLOR_PALETTE[0])
    expect(result.get('b')).toBe(KITTEN_COLOR_PALETTE[0])
  })

  it('wraps around and reuses palette colors once every default kitten has one', () => {
    const kittens = Array.from({ length: KITTEN_COLOR_PALETTE.length + 1 }, (_, i) =>
      series(`k${String(i)}`, i),
    )
    const result = resolveSeriesColors(kittens)
    expect(result.get('k0')).toBe(result.get(`k${String(KITTEN_COLOR_PALETTE.length)}`))
  })

  it('maps every kittenId in the input', () => {
    const result = resolveSeriesColors([series('a', 0), series('b', 1, '#abcdef')])
    expect(result.size).toBe(2)
    expect(result.has('a')).toBe(true)
    expect(result.has('b')).toBe(true)
  })
})
