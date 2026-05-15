import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { type AxisRange, type KittenSeries } from '../../core/graph'
import { isSameLocalDay } from '../../core/time'
import styles from './WeightChart.module.css'

const PALETTE = [
  '#f5b400',
  '#4ade80',
  '#60a5fa',
  '#f472b6',
  '#a78bfa',
  '#fb923c',
  '#22d3ee',
  '#facc15',
]

export function kittenColor(order: number): string {
  if (order < 0) return PALETTE[0] ?? '#f5b400'
  return PALETTE[order % PALETTE.length] ?? '#f5b400'
}

export interface WeightChartProps {
  readonly seriesList: readonly KittenSeries[]
  readonly xRange: AxisRange
  readonly yRange: AxisRange
  // Optional selection: when present, draws a vertical reference line
  // at this time (in ms) so the user has a clear "this feeding is
  // selected" cue across all kittens. Set via onTimeClick.
  readonly selectedTime?: number | null
  // Optional click handler: fires when the user taps the chart with
  // the time (in ms) of the closest data point's X. Caller maps that
  // time to a session.
  readonly onTimeClick?: (time: number) => void
}

function formatTimeTick(millis: number, now: number): string {
  const d = new Date(millis)
  if (isSameLocalDay(millis, now)) {
    return d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
  }
  return d.toLocaleDateString(undefined, {
    month: 'numeric',
    day: 'numeric',
  })
}

function formatGramsTick(grams: number): string {
  return `${Math.round(grams)}g`
}

export function WeightChart({
  seriesList,
  xRange,
  yRange,
  selectedTime,
  onTimeClick,
}: WeightChartProps) {
  const now = useMemo(() => Date.now(), [])

  const hasAnyPoints = seriesList.some((s) => s.points.length > 0)

  if (!hasAnyPoints) {
    return (
      <div className={styles.empty}>
        No weights recorded yet. Tap "Start weights" to begin.
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          margin={{ top: 8, right: 16, bottom: 8, left: 4 }}
          onClick={(state) => {
            if (onTimeClick === undefined) return
            const raw = (state as { activeLabel?: string | number | undefined })
              .activeLabel
            if (raw === undefined) return
            const t = typeof raw === 'number' ? raw : Number(raw)
            if (Number.isFinite(t)) onTimeClick(t)
          }}
        >
          <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="time"
            domain={[xRange.min, xRange.max]}
            tickFormatter={(v: number) => formatTimeTick(v, now)}
            stroke="#a0a0a0"
            fontSize={12}
            allowDuplicatedCategory={false}
          />
          <YAxis
            type="number"
            domain={[yRange.min, yRange.max]}
            tickFormatter={formatGramsTick}
            stroke="#a0a0a0"
            fontSize={12}
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: '#161616',
              border: '1px solid #2a2a2a',
              borderRadius: 6,
              fontSize: 14,
            }}
            labelFormatter={(label) => {
              const millis = typeof label === 'number' ? label : Number(label)
              if (!Number.isFinite(millis)) return ''
              return new Date(millis).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })
            }}
            formatter={(value, name) => {
              const num = typeof value === 'number' ? value : Number(value)
              const grams = Number.isFinite(num) ? `${Math.round(num)}g` : '—'
              return [grams, String(name)]
            }}
          />
          {selectedTime !== undefined &&
            selectedTime !== null &&
            Number.isFinite(selectedTime) && (
              <ReferenceLine
                x={selectedTime}
                stroke="#f5b400"
                strokeWidth={2}
                ifOverflow="extendDomain"
              />
            )}
          {seriesList
            .filter((s) => s.points.length > 0)
            .map((s) => (
              <Line
                key={s.kittenId}
                type="monotone"
                data={s.points as Array<{ time: number; grams: number }>}
                dataKey="grams"
                name={s.displayName}
                stroke={kittenColor(s.order)}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: kittenColor(s.order) }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
