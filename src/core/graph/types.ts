import { type Kitten } from '../kitten'
import { type FeedingSession } from '../session'
import { type WeightEntry } from '../weight'

export interface SeriesPoint {
  readonly time: number
  readonly grams: number
}

export interface KittenSeries {
  readonly kittenId: string
  readonly displayName: string
  readonly order: number
  readonly points: readonly SeriesPoint[]
  // The kitten's raw color override ('' = none). Consumers resolve the
  // actual plotted color via resolveSeriesColors, not this field directly.
  readonly color: string
}

export type GraphMode = 'rough' | 'smooth'

export interface BuildSeriesInput {
  readonly kittens: readonly Kitten[]
  readonly sessions: readonly FeedingSession[]
  readonly weightEntries: readonly WeightEntry[]
  readonly mode: GraphMode
}

export interface AxisRange {
  readonly min: number
  readonly max: number
}
