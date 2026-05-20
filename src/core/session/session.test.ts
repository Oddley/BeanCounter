import { describe, it, expect } from 'vitest'
import {
  createSession,
  touchSession,
  completeSession,
  deleteSession,
  sessionStatus,
  isStale,
  effectiveRecordedAt,
  setRecordedAt,
  clearRecordedAt,
  STALE_THRESHOLD_MS,
  NullFeedingSession,
  type FeedingSession,
} from './index'

describe('createSession', () => {
  it('returns an active session with lockAcquired=true and recordedAt=0', () => {
    const s = createSession({
      id: 'S1',
      litterId: 'L1',
      createdAt: 1000,
    })
    expect(s).toEqual({
      id: 'S1',
      litterId: 'L1',
      createdAt: 1000,
      lastUpdatedAt: 1000,
      recordedAt: 0,
      completed: false,
      lockAcquired: true,
      deleted: false,
    })
  })

  it('sets lastUpdatedAt equal to createdAt initially', () => {
    const s = createSession({ id: 'S1', litterId: 'L1', createdAt: 42 })
    expect(s.lastUpdatedAt).toBe(s.createdAt)
  })
})

describe('touchSession', () => {
  it('updates lastUpdatedAt to now', () => {
    const s = createSession({ id: 'S1', litterId: 'L1', createdAt: 100 })
    const touched = touchSession(s, 500)
    expect(touched.lastUpdatedAt).toBe(500)
  })

  it('preserves other fields', () => {
    const s = createSession({ id: 'S1', litterId: 'L1', createdAt: 100 })
    const touched = touchSession(s, 500)
    expect(touched.id).toBe('S1')
    expect(touched.litterId).toBe('L1')
    expect(touched.createdAt).toBe(100)
    expect(touched.completed).toBe(false)
    expect(touched.lockAcquired).toBe(true)
  })

  it('does not mutate the input', () => {
    const s = createSession({ id: 'S1', litterId: 'L1', createdAt: 100 })
    touchSession(s, 500)
    expect(s.lastUpdatedAt).toBe(100)
  })

  it('is a no-op when the session is already completed', () => {
    const s = completeSession(
      createSession({ id: 'S1', litterId: 'L1', createdAt: 100 }),
    )
    expect(touchSession(s, 500)).toEqual(s)
  })
})

describe('completeSession', () => {
  it('sets completed to true', () => {
    const s = createSession({ id: 'S1', litterId: 'L1', createdAt: 100 })
    expect(completeSession(s).completed).toBe(true)
  })

  it('is idempotent', () => {
    const s = createSession({ id: 'S1', litterId: 'L1', createdAt: 100 })
    expect(completeSession(completeSession(s))).toEqual(completeSession(s))
  })

  it('preserves other fields', () => {
    const s = createSession({ id: 'S1', litterId: 'L1', createdAt: 100 })
    const completed = completeSession(s)
    expect(completed.id).toBe('S1')
    expect(completed.lastUpdatedAt).toBe(100)
  })
})

describe('sessionStatus', () => {
  it('returns completed for a completed session regardless of time', () => {
    const s = completeSession(
      createSession({ id: 'S1', litterId: 'L1', createdAt: 100 }),
    )
    expect(sessionStatus(s, 100)).toBe('completed')
    expect(sessionStatus(s, 100 + STALE_THRESHOLD_MS)).toBe('completed')
    expect(sessionStatus(s, 999999999)).toBe('completed')
  })

  it('returns active when within the stale threshold', () => {
    const s = createSession({ id: 'S1', litterId: 'L1', createdAt: 100 })
    expect(sessionStatus(s, 100)).toBe('active')
    expect(sessionStatus(s, 100 + STALE_THRESHOLD_MS - 1)).toBe('active')
  })

  it('returns stale when at or past the threshold', () => {
    const s = createSession({ id: 'S1', litterId: 'L1', createdAt: 100 })
    expect(sessionStatus(s, 100 + STALE_THRESHOLD_MS)).toBe('stale')
    expect(sessionStatus(s, 100 + STALE_THRESHOLD_MS + 1000)).toBe('stale')
  })

  it('uses lastUpdatedAt for the staleness calculation, not createdAt', () => {
    const s = touchSession(
      createSession({ id: 'S1', litterId: 'L1', createdAt: 0 }),
      5_000_000,
    )
    expect(sessionStatus(s, 5_000_000)).toBe('active')
  })
})

describe('isStale', () => {
  it('returns true iff sessionStatus is stale', () => {
    const s = createSession({ id: 'S1', litterId: 'L1', createdAt: 0 })
    expect(isStale(s, STALE_THRESHOLD_MS - 1)).toBe(false)
    expect(isStale(s, STALE_THRESHOLD_MS)).toBe(true)
  })

  it('returns false for completed sessions even if old', () => {
    const s = completeSession(
      createSession({ id: 'S1', litterId: 'L1', createdAt: 0 }),
    )
    expect(isStale(s, STALE_THRESHOLD_MS * 10)).toBe(false)
  })
})

describe('effectiveRecordedAt', () => {
  it('returns createdAt when recordedAt is 0', () => {
    const s = createSession({ id: 'S1', litterId: 'L1', createdAt: 100 })
    expect(effectiveRecordedAt(s)).toBe(100)
  })

  it('returns recordedAt when it is positive', () => {
    const s = setRecordedAt(
      createSession({ id: 'S1', litterId: 'L1', createdAt: 100 }),
      500,
    )
    expect(effectiveRecordedAt(s)).toBe(500)
  })

  it('returns createdAt after clearRecordedAt', () => {
    const s = clearRecordedAt(
      setRecordedAt(
        createSession({ id: 'S1', litterId: 'L1', createdAt: 100 }),
        500,
      ),
    )
    expect(effectiveRecordedAt(s)).toBe(100)
  })
})

describe('setRecordedAt', () => {
  it('sets recordedAt to the given value', () => {
    const s = createSession({ id: 'S1', litterId: 'L1', createdAt: 100 })
    expect(setRecordedAt(s, 500).recordedAt).toBe(500)
  })

  it('preserves other fields', () => {
    const s = createSession({ id: 'S1', litterId: 'L1', createdAt: 100 })
    const set = setRecordedAt(s, 500)
    expect(set.id).toBe('S1')
    expect(set.createdAt).toBe(100)
    expect(set.completed).toBe(false)
  })

  it('does not mutate the input', () => {
    const s = createSession({ id: 'S1', litterId: 'L1', createdAt: 100 })
    setRecordedAt(s, 500)
    expect(s.recordedAt).toBe(0)
  })
})

describe('clearRecordedAt', () => {
  it('sets recordedAt to 0', () => {
    const s = setRecordedAt(
      createSession({ id: 'S1', litterId: 'L1', createdAt: 100 }),
      500,
    )
    expect(clearRecordedAt(s).recordedAt).toBe(0)
  })

  it('is idempotent', () => {
    const s = createSession({ id: 'S1', litterId: 'L1', createdAt: 100 })
    expect(clearRecordedAt(clearRecordedAt(s))).toEqual(clearRecordedAt(s))
  })
})

describe('NullFeedingSession', () => {
  it('has empty id', () => {
    expect(NullFeedingSession.id).toBe('')
  })

  it('has empty litterId', () => {
    expect(NullFeedingSession.litterId).toBe('')
  })

  it('has completed=false and lockAcquired=false', () => {
    expect(NullFeedingSession.completed).toBe(false)
    expect(NullFeedingSession.lockAcquired).toBe(false)
  })

  it('has recordedAt=0', () => {
    expect(NullFeedingSession.recordedAt).toBe(0)
  })

  it('reports as stale for any non-zero now', () => {
    expect(sessionStatus(NullFeedingSession, STALE_THRESHOLD_MS)).toBe('stale')
  })

  it('satisfies the FeedingSession interface', () => {
    const asSession: FeedingSession = NullFeedingSession
    expect(asSession).toBeDefined()
  })

  it('is not deleted', () => {
    expect(NullFeedingSession.deleted).toBe(false)
  })
})

describe('deleteSession', () => {
  function fixture(overrides: Partial<FeedingSession> = {}): FeedingSession {
    return {
      id: 'S1',
      litterId: 'L1',
      createdAt: 100,
      lastUpdatedAt: 200,
      recordedAt: 0,
      completed: false,
      lockAcquired: true,
      deleted: false,
      ...overrides,
    }
  }

  it('sets deleted=true', () => {
    const s = fixture()
    const result = deleteSession(s, 500)
    expect(result.deleted).toBe(true)
  })

  it('bumps lastUpdatedAt to now', () => {
    const s = fixture({ lastUpdatedAt: 200 })
    const result = deleteSession(s, 500)
    expect(result.lastUpdatedAt).toBe(500)
  })

  it('preserves all other fields', () => {
    const s = fixture({
      id: 'sess-uuid',
      litterId: 'litter-uuid',
      createdAt: 100,
      recordedAt: 150,
      completed: true,
      lockAcquired: false,
    })
    const result = deleteSession(s, 500)
    expect(result.id).toBe('sess-uuid')
    expect(result.litterId).toBe('litter-uuid')
    expect(result.createdAt).toBe(100)
    expect(result.recordedAt).toBe(150)
    expect(result.completed).toBe(true)
    expect(result.lockAcquired).toBe(false)
  })

  it('does not mutate the input', () => {
    const s = fixture()
    deleteSession(s, 500)
    expect(s.deleted).toBe(false)
    expect(s.lastUpdatedAt).toBe(200)
  })

  it('is idempotent — re-deleting still bumps timestamp', () => {
    const s = fixture()
    const once = deleteSession(s, 500)
    const twice = deleteSession(once, 700)
    expect(twice.deleted).toBe(true)
    expect(twice.lastUpdatedAt).toBe(700) // bumped further so a stale
                                          // resurrection from remote
                                          // is overridden by this fresh
                                          // delete
  })

  it('works on NullFeedingSession (sets deleted=true)', () => {
    const result = deleteSession(NullFeedingSession, 500)
    expect(result.deleted).toBe(true)
    expect(result.lastUpdatedAt).toBe(500)
  })
})
