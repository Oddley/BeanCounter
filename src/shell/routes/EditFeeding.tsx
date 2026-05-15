import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppBar, Button } from '../components'
import {
  useSession,
  useActiveKittens,
  useWeightEntriesForSession,
  useLitter,
  persistWeightEntry,
  setSessionRecordedAtById,
} from '../db'
import { effectiveRecordedAt } from '../../core/session'
import { validateGrams } from '../../core/weight'
import { isSameLocalDay } from '../../core/time'
import { runSync } from '../sync'
import styles from './FeedingSession.module.css'

// Edit-mode for an existing (completed or open) feeding session. Tapping a
// feeding on the graph routes here with sessionId in the URL. We pre-fill
// the time and every kitten's weight from current state; explicit Submit
// commits the changes and navigates back to the graph.
//
// No autosave per-row (unlike the new-entry flow). All edits are held in
// component state and persisted as a batch on Submit, so a user who
// changes a value and navigates away loses the edit — explicit semantics
// match the "fix a typo and commit" use case.

function formatClockTime(millis: number, now: number): string {
  if (isSameLocalDay(millis, now)) {
    return new Date(millis).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
  }
  return new Date(millis).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function toLocalDatetimeInputValue(millis: number): string {
  const d = new Date(millis)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseLocalDatetimeInputValue(value: string): number {
  if (!value) return 0
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : 0
}

export function EditFeeding() {
  const navigate = useNavigate()
  const { litterId = '', sessionId = '' } = useParams<{
    litterId: string
    sessionId: string
  }>()

  const litter = useLitter(litterId)
  const session = useSession(sessionId)
  const kittens = useActiveKittens(litterId)
  const entries = useWeightEntriesForSession(sessionId)

  const [now, setNow] = useState<number>(() => Date.now())
  // Map of kittenId → input text. Hydrated once existing entries arrive.
  const [weights, setWeights] = useState<Record<string, string>>({})
  // Time the user picked. 0 means "fall back to session's effective time".
  const [pickedTime, setPickedTime] = useState<number>(0)
  const [hydrated, setHydrated] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    const handle = setInterval(() => {
      setNow(Date.now())
    }, 1_000)
    return () => {
      clearInterval(handle)
    }
  }, [])

  // Hydrate inputs once entries + kittens are loaded.
  useEffect(() => {
    if (hydrated) return
    if (kittens === undefined || entries === undefined || session === undefined)
      return
    if (session === null) return
    const initial: Record<string, string> = {}
    for (const kitten of kittens) {
      const entry = entries.find((e) => e.kittenId === kitten.id)
      initial[kitten.id] = entry ? String(entry.grams) : ''
    }
    setWeights(initial)
    setPickedTime(effectiveRecordedAt(session))
    setHydrated(true)
  }, [hydrated, kittens, entries, session])

  const sessionTime = useMemo(() => {
    if (session === undefined || session === null) return 0
    return pickedTime > 0 ? pickedTime : effectiveRecordedAt(session)
  }, [session, pickedTime])

  if (litter === undefined || session === undefined || kittens === undefined) {
    return (
      <>
        <AppBar title="" backTo={`/litters/${litterId}/graph`} />
        <main className={styles.main}>
          <p className={styles.muted}>Loading…</p>
        </main>
      </>
    )
  }

  if (litter.id === '' || session === null) {
    return (
      <>
        <AppBar title="Not found" backTo={`/litters/${litterId}/graph`} />
        <main className={styles.main}>
          <p className={styles.muted}>
            This feeding session no longer exists.
          </p>
        </main>
      </>
    )
  }

  const handleTimePicked = (value: string) => {
    const parsed = parseLocalDatetimeInputValue(value)
    if (parsed > 0) setPickedTime(parsed)
  }

  const updateWeight = (kittenId: string, raw: string) => {
    setWeights((prev) => ({ ...prev, [kittenId]: raw.replace(/[^\d]/g, '') }))
  }

  // Allow submit when every visible kitten has a valid weight OR is empty.
  // Empty cells mean "no weight recorded" — we won't persist them and
  // won't delete existing ones either (clearing a field is treated as
  // "leave unchanged"). Validation only fires on filled fields.
  const validations = kittens.map((kitten) => {
    const raw = weights[kitten.id] ?? ''
    if (raw === '') return { kittenId: kitten.id, status: 'empty' as const }
    const grams = Number(raw)
    const v = validateGrams(grams)
    return v.valid
      ? { kittenId: kitten.id, status: 'valid' as const, grams }
      : {
          kittenId: kitten.id,
          status: 'invalid' as const,
          message: v.errors[0] ?? 'Invalid',
        }
  })
  const anyInvalid = validations.some((v) => v.status === 'invalid')

  const handleSubmit = async () => {
    if (anyInvalid || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      // eslint-disable-next-line react-hooks/purity -- event-handler timestamp, not render
      const writeAt = Date.now()
      // Persist each kitten's weight value (only the ones with a valid
      // entered weight; empty fields are skipped, not deleted).
      for (const v of validations) {
        if (v.status === 'valid') {
          await persistWeightEntry({
            sessionId,
            kittenId: v.kittenId,
            grams: v.grams,
            now: writeAt,
          })
        }
      }
      // Persist the time choice. effectiveRecordedAt prefers recordedAt
      // over createdAt, so this also updates display in the graph.
      if (pickedTime > 0 && pickedTime !== effectiveRecordedAt(session)) {
        await setSessionRecordedAtById(sessionId, pickedTime)
      }
      // Edit is a meaningful unit of work — push immediately rather than
      // waiting for the next navigation. Fire-and-forget; the indicator
      // will reflect the result asynchronously.
      void runSync()
      void navigate(`/litters/${litterId}/graph`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Save failed')
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    void navigate(`/litters/${litterId}/graph`)
  }

  const onSubmitClick = () => {
    void handleSubmit()
  }

  return (
    <>
      <AppBar
        title={`Edit feeding — ${litter.name}`}
        backTo={`/litters/${litterId}/graph`}
      />
      <main className={styles.main}>
        <div className={styles.timeBar}>
          <div className={styles.timeTapArea}>
            <span className={styles.timeIcon} aria-hidden>
              🕒
            </span>
            <span className={styles.timeDisplay}>
              {formatClockTime(sessionTime, now)}
            </span>
            <input
              type="datetime-local"
              value={toLocalDatetimeInputValue(sessionTime)}
              onChange={(e) => {
                handleTimePicked(e.target.value)
              }}
              className={styles.invisibleDatetime}
              aria-label="Edit recorded weigh-in time"
            />
          </div>
        </div>

        {kittens.length === 0 ? (
          <p className={styles.muted}>
            No active kittens in this litter to edit.
          </p>
        ) : (
          <ul className={styles.list}>
            {kittens.map((kitten) => {
              const v = validations.find((x) => x.kittenId === kitten.id)
              const isInvalid = v?.status === 'invalid'
              return (
                <li key={kitten.id} className={styles.row}>
                  <div className={styles.rowName}>{kitten.displayName}</div>
                  <div className={styles.rowInput}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={weights[kitten.id] ?? ''}
                      onChange={(e) => {
                        updateWeight(kitten.id, e.target.value)
                      }}
                      placeholder="—"
                      className={`${styles.input} ${isInvalid ? styles.invalid : ''}`}
                      aria-label={`Weight in grams for ${kitten.displayName}`}
                    />
                    <span className={styles.unit}>g</span>
                  </div>
                  {isInvalid && (
                    <div className={styles.errorLine} role="alert">
                      {v.message}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {submitError !== null && (
          <p className={styles.errorLine} role="alert">
            {submitError}
          </p>
        )}

        <div className={styles.finish}>
          <Button onClick={onSubmitClick} disabled={anyInvalid || submitting}>
            {submitting ? 'Saving…' : 'Submit'}
          </Button>
          <Button variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </main>
    </>
  )
}
