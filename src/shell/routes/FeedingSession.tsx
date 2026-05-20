import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppBar, Button } from '../components'
import {
  useLitter,
  useActiveKittens,
  useOpenSessionForLitter,
  useWeightEntriesForSession,
  ensureOpenSessionForLitter,
  ensureOpenSessionWithRecordedAt,
  completeSessionById,
  setSessionRecordedAtById,
  clearSessionRecordedAtById,
  persistWeightEntry,
  deleteWeightEntryById,
} from '../db'
import {
  effectiveRecordedAt,
  STALE_THRESHOLD_MS,
} from '../../core/session'
import { type Kitten } from '../../core/kitten'
import { validateGrams } from '../../core/weight'
import { isSameLocalDay } from '../../core/time'
import { runSync } from '../sync'
import styles from './FeedingSession.module.css'

function formatClockTime(millis: number, now: number): string {
  if (isSameLocalDay(millis, now)) {
    return new Date(millis).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
  }
  const target = new Date(millis)
  const sameYear = target.getFullYear() === new Date(now).getFullYear()
  return target.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
  })
}

function toLocalDatetimeInputValue(millis: number): string {
  const d = new Date(millis)
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mi = pad(d.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

function parseLocalDatetimeInputValue(value: string): number {
  if (!value) return 0
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : 0
}

export function FeedingSession() {
  const navigate = useNavigate()
  const { litterId = '' } = useParams<{ litterId: string }>()
  const litter = useLitter(litterId)
  const kittens = useActiveKittens(litterId)
  const openSession = useOpenSessionForLitter(litterId)
  const entries = useWeightEntriesForSession(openSession?.id ?? '')

  const [now, setNow] = useState<number>(() => Date.now())
  // Parent-owned weights state: source of truth for "what the user has
  // typed" (independent of Dexie roundtrip). Allows Submit's enabled
  // state to react instantly without waiting on a debounce-then-query.
  const [weights, setWeights] = useState<Record<string, string>>({})
  // Track which session we've hydrated from to avoid clobbering user
  // edits when entries re-flow from live query (e.g., after eager
  // save commits).
  const hydratedSessionIdRef = useRef<string | null>(null)
  // In-flight Dexie writes; Submit awaits these so a fast double-tap
  // (type-last-digit → tap-Submit) doesn't race the weight write
  // against the completeSession write.
  const pendingWritesRef = useRef<Set<Promise<unknown>>>(new Set())

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const timePickerRef = useRef<HTMLInputElement>(null)

  // Tick `now` once per second so the live clock advances smoothly
  // and the stale-banner threshold is re-evaluated as time passes.
  useEffect(() => {
    const handle = setInterval(() => {
      setNow(Date.now())
    }, 1_000)
    return () => {
      clearInterval(handle)
    }
  }, [])

  // Hydrate weights from existing entries the first time we see them
  // for this session. Switching sessions (Submit + start fresh) resets
  // hydration so the new session's entries (which start empty) load.
  useEffect(() => {
    if (openSession === undefined || openSession === null) return
    if (entries === undefined) return
    if (hydratedSessionIdRef.current === openSession.id) return
    const initial: Record<string, string> = {}
    for (const e of entries) {
      initial[e.kittenId] = String(e.grams)
    }
    setWeights(initial)
    hydratedSessionIdRef.current = openSession.id
  }, [openSession, entries])

  // Persistence helper. Queues the write so Submit can await it.
  const trackWrite = <T,>(promise: Promise<T>): Promise<T> => {
    pendingWritesRef.current.add(promise)
    void promise.finally(() => {
      pendingWritesRef.current.delete(promise)
    })
    return promise
  }

  const persistWeight = (kittenId: string, sanitized: string) => {
    if (sanitized === '') {
      // Cleared input — remove any existing entry so it doesn't
      // linger as a phantom value. No-op if no entry exists.
      const sessionId = openSession?.id
      if (sessionId === undefined || sessionId === null) return
      void trackWrite(deleteWeightEntryById(sessionId, kittenId))
      return
    }
    const grams = Number(sanitized)
    if (!validateGrams(grams).valid) return
    const writeNow = Date.now()
    const work = async () => {
      const sessionId =
        openSession?.id ??
        (await ensureOpenSessionForLitter(litterId, writeNow)).id
      await persistWeightEntry({
        sessionId,
        kittenId,
        grams,
        now: writeNow,
      })
    }
    void trackWrite(work())
  }

  const handleChange = (kittenId: string, raw: string) => {
    const sanitized = raw.replace(/[^\d]/g, '')
    setWeights((prev) => ({ ...prev, [kittenId]: sanitized }))
    persistWeight(kittenId, sanitized)
  }

  // Computed flags. These read parent state (not Dexie) so they react
  // instantly to keystrokes.
  const allFilledIn = useMemo(() => {
    if (!kittens || kittens.length === 0) return false
    return kittens.every((k) => {
      const text = weights[k.id]
      if (text === undefined || text === '') return false
      return validateGrams(Number(text)).valid
    })
  }, [kittens, weights])

  // "Stale" warning criterion (per user): session has data AND its
  // creation time is older than the threshold. Uses createdAt (not
  // lastUpdatedAt or recordedAt) because the latter two can both be
  // user-edited and would mask "this was actually started long ago".
  const showStaleBanner =
    openSession !== null &&
    openSession !== undefined &&
    entries !== undefined &&
    entries.length > 0 &&
    now - openSession.createdAt > STALE_THRESHOLD_MS

  const handleSubmit = async () => {
    if (openSession === null || openSession === undefined) {
      void navigate(`/litters/${litterId}`)
      return
    }
    // Wait for any in-flight weight writes to settle so we don't
    // complete-the-session before the last keystroke's persist lands.
    const inFlight = Array.from(pendingWritesRef.current)
    if (inFlight.length > 0) {
      await Promise.allSettled(inFlight)
    }
    await completeSessionById(openSession.id)
    // Reset hydration so a new session (after this completes) starts
    // with a fresh empty weights map.
    hydratedSessionIdRef.current = null
    setWeights({})
    // Fire-and-forget immediate sync on Submit. completeSession marks
    // dirty, but the nav that follows is a sibling sync trigger too;
    // explicit runSync here just hurries it.
    void runSync()
    void navigate(`/litters/${litterId}`)
  }

  const onSubmit = () => {
    void handleSubmit()
  }

  const handleEnterAtRow = (index: number) => {
    const next = inputRefs.current[index + 1]
    if (next) {
      next.focus()
      return
    }
    // Last row — if everything's filled, fire Submit. Otherwise blur
    // to dismiss the keyboard.
    if (allFilledIn) {
      void handleSubmit()
    } else {
      inputRefs.current[index]?.blur()
    }
  }

  if (
    litter === undefined ||
    openSession === undefined ||
    kittens === undefined
  ) {
    return (
      <>
        <AppBar title="" backTo={`/litters/${litterId}`} />
        <main className={styles.main}>
          <p className={styles.muted}>Loading…</p>
        </main>
      </>
    )
  }

  if (litter.id === '') {
    return (
      <>
        <AppBar title="Not found" backTo="/litters" />
        <main className={styles.main}>
          <p className={styles.muted}>This litter doesn&apos;t exist.</p>
        </main>
      </>
    )
  }

  const displayTimeMillis =
    openSession === null ? now : effectiveRecordedAt(openSession)
  const isUserModified =
    openSession !== null && openSession.recordedAt > 0

  const handleTimePicked = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const picked = parseLocalDatetimeInputValue(event.target.value)
    if (picked <= 0) return
    if (openSession === null) {
      await ensureOpenSessionWithRecordedAt(litterId, Date.now(), picked)
    } else {
      await setSessionRecordedAtById(openSession.id, picked)
    }
  }

  const handleResetTime = async () => {
    if (openSession === null || openSession.recordedAt === 0) return
    await clearSessionRecordedAtById(openSession.id)
  }

  return (
    <>
      <AppBar
        title={`Weights — ${litter.name}`}
        backTo={`/litters/${litterId}`}
      />
      <main className={styles.main}>
        {showStaleBanner && (
          <div className={styles.staleBanner} role="status">
            ⚠ This may be a stale session — started{' '}
            {formatClockTime(openSession.createdAt, now)}.
          </div>
        )}

        <div className={styles.timeBar}>
          <div className={styles.timeTapArea}>
            <span className={styles.timeIcon} aria-hidden>
              🕒
            </span>
            <span className={styles.timeDisplay}>
              {formatClockTime(displayTimeMillis, now)}
            </span>
            <input
              ref={timePickerRef}
              type="datetime-local"
              value={toLocalDatetimeInputValue(displayTimeMillis)}
              onChange={(e) => {
                void handleTimePicked(e)
              }}
              className={styles.invisibleDatetime}
              aria-label="Edit recorded weigh-in time"
            />
          </div>
          {isUserModified && (
            <button
              type="button"
              className={styles.resetButton}
              onClick={() => {
                void handleResetTime()
              }}
              aria-label="Reset to start of weigh-in"
            >
              ↺
            </button>
          )}
        </div>

        {kittens.length === 0 ? (
          <p className={styles.muted}>
            No active kittens in this litter. Add one before recording
            weights.
          </p>
        ) : (
          <ul className={styles.list}>
            {kittens.map((kitten, i) => (
              <KittenWeightRow
                key={kitten.id}
                kitten={kitten}
                value={weights[kitten.id] ?? ''}
                isLast={i === kittens.length - 1}
                inputRef={(el) => {
                  inputRefs.current[i] = el
                }}
                onChange={(text) => {
                  handleChange(kitten.id, text)
                }}
                onEnter={() => {
                  handleEnterAtRow(i)
                }}
              />
            ))}
          </ul>
        )}

        <div className={styles.finish}>
          <Button onClick={onSubmit} disabled={!allFilledIn}>
            Submit
          </Button>
        </div>
      </main>
    </>
  )
}

interface KittenWeightRowProps {
  readonly kitten: Kitten
  readonly value: string
  readonly isLast: boolean
  readonly inputRef: (el: HTMLInputElement | null) => void
  readonly onChange: (text: string) => void
  readonly onEnter: () => void
}

function KittenWeightRow({
  kitten,
  value,
  isLast,
  inputRef,
  onChange,
  onEnter,
}: KittenWeightRowProps) {
  const validation = value === '' ? null : validateGrams(Number(value))
  const showError = value !== '' && validation !== null && !validation.valid

  return (
    <li className={styles.row}>
      <div className={styles.rowName}>{kitten.displayName}</div>
      <div className={styles.rowInput}>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          enterKeyHint={isLast ? 'done' : 'next'}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onEnter()
            }
          }}
          placeholder="—"
          className={`${styles.input} ${showError ? styles.invalid : ''}`}
          aria-label={`Weight in grams for ${kitten.displayName}`}
        />
        <span className={styles.unit}>g</span>
      </div>
      {showError && (
        <div className={styles.errorLine} role="alert">
          {validation?.errors[0] ?? 'Invalid'}
        </div>
      )}
    </li>
  )
}
