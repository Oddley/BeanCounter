export interface FeedingSession {
  readonly id: string
  readonly litterId: string
  readonly createdAt: number
  readonly lastUpdatedAt: number
  readonly recordedAt: number
  readonly completed: boolean
  readonly lockAcquired: boolean
  // Soft-delete tombstone. `true` means the user deleted this session;
  // queries filter these out, but the record persists in storage so
  // multi-device sync sees the deletion (via lastUpdatedAt LWW) and
  // propagates it. Without this flag, a physical local delete would be
  // indistinguishable from "this device hasn't seen the entity yet"
  // and the merge would re-resurrect the entity from Drive.
  readonly deleted: boolean
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
  deleted: false,
})
