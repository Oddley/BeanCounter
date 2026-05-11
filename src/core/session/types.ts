export interface FeedingSession {
  readonly id: string
  readonly litterId: string
  readonly createdAt: number
  readonly lastUpdatedAt: number
  readonly recordedAt: number
  readonly completed: boolean
  readonly lockAcquired: boolean
}

export type SessionStatus = 'active' | 'completed' | 'stale'

export const STALE_THRESHOLD_MS = 30 * 60 * 1000

export const NullFeedingSession: FeedingSession = Object.freeze({
  id: '',
  litterId: '',
  createdAt: 0,
  lastUpdatedAt: 0,
  recordedAt: 0,
  completed: false,
  lockAcquired: false,
})
