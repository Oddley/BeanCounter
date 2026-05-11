import { effectiveRecordedAt } from '../session'
import { startOfLocalDay, localDayDiff, addDays } from '../time'
import {
  type AxisRange,
  type BuildSeriesInput,
  type KittenSeries,
  type SeriesPoint,
} from './types'

export function buildSeries(input: BuildSeriesInput): KittenSeries[] {
  const sessionsById = new Map(input.sessions.map((s) => [s.id, s]))

  const rawByKitten = new Map<string, SeriesPoint[]>()
  for (const e of input.weightEntries) {
    const s = sessionsById.get(e.sessionId)
    if (!s) continue
    const points = rawByKitten.get(e.kittenId) ?? []
    points.push({ time: effectiveRecordedAt(s), grams: e.grams })
    rawByKitten.set(e.kittenId, points)
  }

  return input.kittens.map((kitten) => {
    const raw = (rawByKitten.get(kitten.id) ?? []).slice().sort(byTimeAsc)
    const points =
      input.mode === 'rough' ? raw : smoothByDailyAverageWithInterpolation(raw)
    return {
      kittenId: kitten.id,
      displayName: kitten.displayName,
      order: kitten.order,
      points,
    }
  })
}

function byTimeAsc(a: SeriesPoint, b: SeriesPoint): number {
  return a.time - b.time
}

function smoothByDailyAverageWithInterpolation(
  raw: readonly SeriesPoint[],
): SeriesPoint[] {
  if (raw.length === 0) return []

  // Group by local day; average grams within each day.
  const byDay = new Map<number, { sum: number; count: number }>()
  for (const p of raw) {
    const dayStart = startOfLocalDay(p.time)
    const existing = byDay.get(dayStart) ?? { sum: 0, count: 0 }
    byDay.set(dayStart, {
      sum: existing.sum + p.grams,
      count: existing.count + 1,
    })
  }

  const knownDays: SeriesPoint[] = Array.from(byDay.entries())
    .map(([time, { sum, count }]) => ({ time, grams: sum / count }))
    .sort(byTimeAsc)

  if (knownDays.length === 1) {
    return knownDays
  }

  // Linearly interpolate missing days between consecutive known points.
  const result: SeriesPoint[] = []
  for (let i = 0; i < knownDays.length - 1; i++) {
    const start = knownDays[i]
    const end = knownDays[i + 1]
    if (!start || !end) continue

    result.push(start)
    const span = localDayDiff(end.time, start.time)
    for (let d = 1; d < span; d++) {
      const t = d / span
      result.push({
        time: addDays(start.time, d),
        grams: start.grams + (end.grams - start.grams) * t,
      })
    }
  }
  const last = knownDays[knownDays.length - 1]
  if (last) result.push(last)

  return result
}

export function yAxisRange(seriesList: readonly KittenSeries[]): AxisRange {
  let min = Infinity
  let max = -Infinity
  for (const series of seriesList) {
    for (const point of series.points) {
      if (point.grams < min) min = point.grams
      if (point.grams > max) max = point.grams
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 0 }
  }
  const span = max - min
  const padding = span > 0 ? span * 0.05 : 5
  return { min: min - padding, max: max + padding }
}

export function xAxisRange(seriesList: readonly KittenSeries[]): AxisRange {
  let min = Infinity
  let max = -Infinity
  for (const series of seriesList) {
    for (const point of series.points) {
      if (point.time < min) min = point.time
      if (point.time > max) max = point.time
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 0 }
  }
  return { min, max }
}
