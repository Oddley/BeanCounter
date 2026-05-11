import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  AppBar,
  GraphModeToggle,
  KittenLegend,
  WeightChart,
} from '../components'
import {
  useLitter,
  useActiveKittens,
  useAllSessions,
  useAllWeightEntries,
} from '../db'
import {
  buildSeries,
  xAxisRange,
  yAxisRange,
  type GraphMode,
} from '../../core/graph'
import styles from './LitterGraph.module.css'

export function LitterGraph() {
  const { id: litterId = '' } = useParams<{ id: string }>()
  const litter = useLitter(litterId)
  const activeKittens = useActiveKittens(litterId)
  const allSessions = useAllSessions()
  const allEntries = useAllWeightEntries()

  const [mode, setMode] = useState<GraphMode>('rough')
  const [focusedKittenId, setFocusedKittenId] = useState<string | null>(null)

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
          <p className={styles.muted}>This litter doesn't exist.</p>
          <Link to="/litters">Back to litters</Link>
        </main>
      </>
    )
  }

  const handleToggleFocus = (kittenId: string) => {
    setFocusedKittenId((current) => (current === kittenId ? null : kittenId))
  }

  return (
    <>
      <AppBar title={`${litter.name} — graph`} backTo={`/litters/${litterId}`} />
      <main className={styles.main}>
        <div className={styles.toolbar}>
          <GraphModeToggle mode={mode} onChange={setMode} />
          {focusedKittenId !== null && (
            <button
              type="button"
              className={styles.clearFocus}
              onClick={() => setFocusedKittenId(null)}
            >
              Show all
            </button>
          )}
        </div>

        <WeightChart
          seriesList={seriesForChart}
          xRange={xRange}
          yRange={yRange}
        />

        <KittenLegend
          seriesList={seriesAll}
          focusedKittenId={focusedKittenId}
          onToggleFocus={handleToggleFocus}
        />
      </main>
    </>
  )
}
