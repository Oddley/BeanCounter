import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppBar, Button } from '../components'
import {
  useLitter,
  useActiveKittens,
  useOpenSessionForLitter,
  useWeightEntriesForSession,
  ensureOpenSessionForLitter,
  ensureOpenSessionWithRecordedAt,
  touchSessionById,
  completeSessionById,
  setSessionRecordedAtById,
  clearSessionRecordedAtById,
  persistWeightEntry,
} from '../db'
import {
  isStale,
  effectiveRecordedAt,
  type FeedingSession as FeedingSessionType,
} from '../../core/session'
import { type Kitten } from '../../core/kitten'
import { type WeightEntry, validateGrams } from '../../core/weight'
import { isSameLocalDay } from '../../core/time'
import { useAutosave } from '../hooks'
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

  const [now, setNow] = useState(Date.now())
  const [resumeChoiceMade, setResumeChoiceMade] = useState(false)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const timePickerRef = useRef<HTMLInputElement>(null)

  // tick `now` once per second so the live clock advances smoothly
  // (also used for staleness checks)
  useEffect(() => {
    const handle = setInterval(() => {
      setNow(Date.now())
    }, 1_000)
    return () => {
      clearInterval(handle)
    }
  }, [])

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
          <p className={styles.muted}>This litter doesn't exist.</p>
        </main>
      </>
    )
  }

  const sessionIsStale =
    openSession !== null && isStale(openSession, now) && !resumeChoiceMade

  const allFilledIn =
    kittens.length > 0 &&
    entries !== undefined &&
    kittens.every((k) => entries.some((e) => e.kittenId === k.id))

  const handleResume = async () => {
    if (openSession === null) return
    await touchSessionById(openSession.id, Date.now())
    setResumeChoiceMade(true)
  }

  const handleRestart = async () => {
    if (openSession === null) return
    await completeSessionById(openSession.id)
    setResumeChoiceMade(true)
  }

  const handleFinish = async () => {
    if (openSession === null) {
      navigate(`/litters/${litterId}`)
      return
    }
    await completeSessionById(openSession.id)
    navigate(`/litters/${litterId}`)
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

  const handleEnterAtRow = (index: number) => {
    const next = inputRefs.current[index + 1]
    if (next) {
      next.focus()
      return
    }
    // Last row — try to finish if everything's filled
    if (allFilledIn) {
      void handleFinish()
    } else {
      // Otherwise just blur to dismiss the keyboard
      inputRefs.current[index]?.blur()
    }
  }

  return (
    <>
      <AppBar
        title={`Weights — ${litter.name}`}
        backTo={`/litters/${litterId}`}
      />
      <main className={styles.main}>
        {sessionIsStale && openSession !== null && (
          <div className={styles.resumeModal} role="dialog">
            <h2 className={styles.resumeTitle}>Resume previous weights?</h2>
            <p className={styles.resumeBody}>
              The last weight entry for this litter was over 30 minutes ago.
              Resume that session, or start a fresh one?
            </p>
            <div className={styles.resumeButtons}>
              <Button onClick={handleResume}>Resume</Button>
              <Button variant="secondary" onClick={handleRestart}>
                Start fresh
              </Button>
            </div>
          </div>
        )}

        {!sessionIsStale && (
          <>
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
                    litterId={litterId}
                    session={openSession}
                    isLast={i === kittens.length - 1}
                    inputRef={(el) => {
                      inputRefs.current[i] = el
                    }}
                    onEnter={() => handleEnterAtRow(i)}
                  />
                ))}
              </ul>
            )}

            <div className={styles.finish}>
              <Button onClick={handleFinish} disabled={!allFilledIn}>
                Finish weights
              </Button>
            </div>
          </>
        )}
      </main>
    </>
  )
}

interface KittenWeightRowProps {
  readonly kitten: Kitten
  readonly litterId: string
  readonly session: FeedingSessionType | null
  readonly isLast: boolean
  readonly inputRef: (el: HTMLInputElement | null) => void
  readonly onEnter: () => void
}

function KittenWeightRow({
  kitten,
  litterId,
  session,
  isLast,
  inputRef,
  onEnter,
}: KittenWeightRowProps) {
  const entries = useWeightEntriesForSession(session?.id ?? '')
  const existing: WeightEntry | undefined = entries?.find(
    (e) => e.kittenId === kitten.id,
  )

  const [text, setText] = useState('')
  const [touched, setTouched] = useState(false)

  // Hydrate from existing entry when it arrives
  useEffect(() => {
    if (existing && !touched) {
      setText(String(existing.grams))
    }
  }, [existing, touched])

  const parsed = text === '' ? NaN : Number(text)
  const validation = text === '' ? null : validateGrams(parsed)
  const isValid = validation !== null && validation.valid

  useAutosave({
    value: text,
    delayMs: 400,
    enabled: isValid,
    onSave: async (currentText) => {
      const grams = Number(currentText)
      if (!validateGrams(grams).valid) return
      const now = Date.now()
      const sessionId =
        session?.id ?? (await ensureOpenSessionForLitter(litterId, now)).id
      await persistWeightEntry({
        sessionId,
        kittenId: kitten.id,
        grams,
        now,
      })
    },
  })

  const showError = text !== '' && validation !== null && !validation.valid

  return (
    <li className={styles.row}>
      <div className={styles.rowName}>{kitten.displayName}</div>
      <div className={styles.rowInput}>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          enterKeyHint={isLast ? 'done' : 'next'}
          value={text}
          onChange={(e) => {
            setTouched(true)
            setText(e.target.value.replace(/[^\d]/g, ''))
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
