import { useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  AppBar,
  Button,
  GraphModeToggle,
  KittenLegend,
  WeightChart,
} from '../components'
import {
  useLitter,
  useActiveKittens,
  useAllSessions,
  useAllWeightEntries,
  deleteSessionById,
} from '../db'
import { runSync } from '../sync'
import {
  buildSeries,
  xAxisRange,
  yAxisRange,
  type GraphMode,
} from '../../core/graph'
import { effectiveRecordedAt } from '../../core/session'
import { isSameLocalDay } from '../../core/time'
import styles from './LitterGraph.module.css'

function formatFeedingTime(millis: number, now: number): string {
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

export function LitterGraph() {
  const navigate = useNavigate()
  const { id: litterId = '' } = useParams<{ id: string }>()
  const litter = useLitter(litterId)
  const activeKittens = useActiveKittens(litterId)
  const allSessions = useAllSessions()
  const allEntries = useAllWeightEntries()

  const [mode, setMode] = useState<GraphMode>('rough')
  const [focusedKittenId, setFocusedKittenId] = useState<string | null>(null)
  // Selected feeding session (for the Edit affordance). Cleared when the
  // graph mode changes (smooth points aren't 1:1 with sessions, so the
  // concept doesn't apply there). Tapping the same selection clears it.
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  )
  // "now" is only used to decide whether the selected feeding's time
  // formats as time-of-day or with a date prefix. Stable for the
  // lifetime of this view is fine. Declared up here (before any early
  // return) so hook order is consistent across renders.
  const now = useMemo<number>(() => Date.now(), [])

  // Sorted by effectiveRecordedAt so the stepper arrows (below) move
  // chronologically: ← = earlier feeding, → = later feeding. Declared
  // up here (before any early return) for the same hook-order reason
  // as `now` — placing it after the loading/not-found returns below
  // would call useMemo conditionally and trigger React error #310.
  const sortedLitterSessions = useMemo(
    () =>
      (allSessions ?? [])
        .filter((s) => s.litterId === litterId)
        .slice()
        .sort((a, b) => effectiveRecordedAt(a) - effectiveRecordedAt(b)),
    [allSessions, litterId],
  )

  const loading =
    litter === undefined ||
    activeKittens === undefined ||
    allSessions === undefined ||
    allEntries === undefined

  const { seriesAll, seriesForChart, xRange, yRange } = useMemo(() => {
    if (loading || litter === undefined) {
      return {
        seriesAll: [],
        seriesForChart: [],
        xRange: { min: 0, max: 0 },
        yRange: { min: 0, max: 0 },
      }
    }
    const sessions = (allSessions ?? []).filter((s) => s.litterId === litterId)
    const sessionIds = new Set(sessions.map((s) => s.id))
    const entries = (allEntries ?? []).filter((e) => sessionIds.has(e.sessionId))
    const kittens = activeKittens ?? []

    const all = buildSeries({ kittens, sessions, weightEntries: entries, mode })

    const focused =
      focusedKittenId !== null
        ? kittens.find((k) => k.id === focusedKittenId)
        : undefined
    const subset = focused
      ? buildSeries({
          kittens: [focused],
          sessions,
          weightEntries: entries,
          mode,
        })
      : all

    return {
      seriesAll: all,
      seriesForChart: subset,
      xRange: xAxisRange(subset),
      yRange: yAxisRange(subset),
    }
  }, [
    loading,
    litter,
    activeKittens,
    allSessions,
    allEntries,
    litterId,
    mode,
    focusedKittenId,
  ])

  if (loading) {
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
          <Link to="/litters">Back to litters</Link>
        </main>
      </>
    )
  }

  const handleToggleFocus = (kittenId: string) => {
    setFocusedKittenId((current) => (current === kittenId ? null : kittenId))
  }

  // Map a tooltip-position X-axis time to the session that recorded at
  // (or nearest to) that time. Fires continuously as the user
  // hovers/drags/taps across the chart, mirroring Recharts' tooltip.
  // Only meaningful in rough mode, where each point corresponds to
  // exactly one session.
  const handleTimeChange = (time: number) => {
    if (mode !== 'rough') return
    if (sortedLitterSessions.length === 0) return
    let best = sortedLitterSessions[0]
    if (best === undefined) return
    let bestDelta = Math.abs(effectiveRecordedAt(best) - time)
    for (const s of sortedLitterSessions) {
      const delta = Math.abs(effectiveRecordedAt(s) - time)
      if (delta < bestDelta) {
        best = s
        bestDelta = delta
      }
    }
    // Always reflect the current tooltip position; no toggle-off. The
    // ref-equality bail-out in React's state setter prevents needless
    // re-renders when the cursor stays within the same feeding.
    setSelectedSessionId((current) => (current === best.id ? current : best.id))
  }

  // When the user switches modes we drop selection — smooth-mode points
  // aren't single feedings, so the concept doesn't apply there.
  const handleModeChange = (next: GraphMode) => {
    if (next !== mode) {
      setSelectedSessionId(null)
    }
    setMode(next)
  }

  const selectedSession =
    selectedSessionId !== null
      ? sortedLitterSessions.find((s) => s.id === selectedSessionId)
      : undefined
  const selectedTime =
    selectedSession !== undefined ? effectiveRecordedAt(selectedSession) : null

  // Stepper navigation: the arrows surface only when something is
  // selected. Foster mama's reported pain is "graph gets crowded and
  // the initial tap is imprecise" — the stepper lets her tap-near,
  // then refine one feeding at a time without re-aiming on the chart.
  const selectedIndex =
    selectedSession !== undefined
      ? sortedLitterSessions.findIndex((s) => s.id === selectedSession.id)
      : -1
  const canStepPrev = selectedIndex > 0
  const canStepNext =
    selectedIndex >= 0 && selectedIndex < sortedLitterSessions.length - 1
  const stepPrev = () => {
    if (!canStepPrev) return
    const prev = sortedLitterSessions[selectedIndex - 1]
    if (prev) setSelectedSessionId(prev.id)
  }
  const stepNext = () => {
    if (!canStepNext) return
    const next = sortedLitterSessions[selectedIndex + 1]
    if (next) setSelectedSessionId(next.id)
  }

  return (
    <>
      <AppBar title={`${litter.name} — graph`} backTo={`/litters/${litterId}`} />
      <main className={styles.main}>
        <div className={styles.toolbar}>
          <GraphModeToggle mode={mode} onChange={handleModeChange} />
          {focusedKittenId !== null && (
            <button
              type="button"
              className={styles.clearFocus}
              onClick={() => {
                setFocusedKittenId(null)
                setSelectedSessionId(null)
              }}
            >
              Show all
            </button>
          )}
        </div>

        <WeightChart
          seriesList={seriesForChart}
          xRange={xRange}
          yRange={yRange}
          selectedTime={selectedTime}
          onTimeChange={handleTimeChange}
        />

        <KittenLegend
          seriesList={seriesAll}
          focusedKittenId={focusedKittenId}
          onToggleFocus={handleToggleFocus}
        />

        {mode === 'rough' && (
          <div className={styles.editBar}>
            {selectedSession !== undefined && selectedTime !== null ? (
              <>
                <div className={styles.stepperRow}>
                  <Button
                    variant="secondary"
                    onClick={stepPrev}
                    disabled={!canStepPrev}
                    aria-label="Previous feeding"
                    className={styles.stepperButton}
                  >
                    ‹
                  </Button>
                  <Button
                    onClick={() => {
                      void navigate(
                        `/litters/${litterId}/edit-feeding/${selectedSession.id}`,
                      )
                    }}
                    className={styles.editButton}
                  >
                    Edit feeding at {formatFeedingTime(selectedTime, now)}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={stepNext}
                    disabled={!canStepNext}
                    aria-label="Next feeding"
                    className={styles.stepperButton}
                  >
                    ›
                  </Button>
                </div>
                <Button
                  variant="danger"
                  onClick={() => {
                    // Destructive: nukes the session and all its weight
                    // entries. Confirm with the user before committing.
                    // window.confirm matches the established pattern in
                    // Debug.tsx (wipe-all-data flow).
                    const formatted = formatFeedingTime(selectedTime, now)
                    const ok = window.confirm(
                      `Delete the feeding at ${formatted}? All weight entries for this feeding will be removed. This can't be undone.`,
                    )
                    if (!ok) return
                    const sessionId = selectedSession.id
                    setSelectedSessionId(null)
                    void deleteSessionById(sessionId).then(() => {
                      // Fire-and-forget sync so the deletion propagates
                      // to other devices without waiting for navigation.
                      void runSync()
                    })
                  }}
                >
                  Delete feeding
                </Button>
              </>
            ) : (
              <p className={styles.editHint}>
                Tap a feeding on the graph to edit it.
              </p>
            )}
          </div>
        )}
      </main>
    </>
  )
}
