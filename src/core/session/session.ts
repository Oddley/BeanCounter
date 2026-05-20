import {
  type FeedingSession,
  type SessionStatus,
  STALE_THRESHOLD_MS,
} from './types'

export function createSession(input: {
  id: string
  litterId: string
  createdAt: number
}): FeedingSession {
  return {
    id: input.id,
    litterId: input.litterId,
    createdAt: input.createdAt,
    lastUpdatedAt: input.createdAt,
    recordedAt: 0,
    completed: false,
    lockAcquired: true,
    deleted: false,
  }
}

// Soft-delete the session by flipping the tombstone flag and bumping
// lastUpdatedAt. Physical removal is unsafe in our sync model — a
// missing-on-local entity is indistinguishable from "remote has new
// content we haven't pulled yet," so the next merge would resurrect
// the deletion. Tombstones make the deletion explicit and let LWW do
// its job.
//
// Idempotent: re-deleting an already-deleted session bumps the
// timestamp again (so a stale resurrection from remote is overridden
// by the fresh delete).
export function deleteSession(
  session: FeedingSession,
  now: number,
): FeedingSession {
  return { ...session, deleted: true, lastUpdatedAt: now }
}

export function touchSession(
  session: FeedingSession,
  now: number,
): FeedingSession {
  if (session.completed) return session
  return { ...session, lastUpdatedAt: now }
}

export function completeSession(session: FeedingSession): FeedingSession {
  return { ...session, completed: true }
}

export function sessionStatus(
  session: FeedingSession,
  now: number,
): SessionStatus {
  if (session.completed) return 'completed'
  if (now - session.lastUpdatedAt >= STALE_THRESHOLD_MS) return 'stale'
  return 'active'
}

export function isStale(session: FeedingSession, now: number): boolean {
  return sessionStatus(session, now) === 'stale'
}

export function effectiveRecordedAt(session: FeedingSession): number {
  return session.recordedAt > 0 ? session.recordedAt : session.createdAt
}

export function setRecordedAt(
  session: FeedingSession,
  time: number,
): FeedingSession {
  return { ...session, recordedAt: time }
}

export function clearRecordedAt(session: FeedingSession): FeedingSession {
  return { ...session, recordedAt: 0 }
}
