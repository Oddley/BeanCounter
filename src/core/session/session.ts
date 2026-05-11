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
  }
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
