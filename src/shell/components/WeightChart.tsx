import { useEffect, useMemo, useRef } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
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
  // selected" cue across all kittens that persists after the touch
  // ends (Recharts' own tooltip cursor disappears on touch-end).
  readonly selectedTime?: number | null
  // Optional change handler: fires every time Recharts' tooltip changes
  // its active label — covers desktop hover, mobile tap, AND mobile
  // touchmove drag (unlike LineChart's onMouseMove prop, which only
  // catches mouse-style events). Receives time (ms) of the closest
  // data point. Caller maps that time to a session.
  readonly onTimeChange?: (time: number) => void
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

// Recharts passes these props to a Tooltip's `content` element.
interface TooltipContentProps {
  readonly active?: boolean
  readonly label?: string | number
  readonly payload?: ReadonlyArray<{
    readonly name?: string | number
    readonly value?: string | number
    readonly color?: string
  }>
}

interface TrackingTooltipProps extends TooltipContentProps {
  readonly onLabelChange?: (label: number) => void
}

// Custom tooltip content. Renders the same visual treatment as the
// default Recharts tooltip, AND notifies the parent of every active-
// label change via a useEffect. Using a custom content element is the
// canonical Recharts pattern for "react to tooltip state" — and unlike
// the LineChart's onMouseMove prop, it fires reliably on touchmove
// drags as well as mouse moves and taps.
function TrackingTooltip({
  active,
  label,
  payload,
  onLabelChange,
}: TrackingTooltipProps) {
  const millis =
    typeof label === 'number' ? label : label !== undefined ? Number(label) : NaN

  useEffect(() => {
    if (active !== true) return
    if (!Number.isFinite(millis)) return
    onLabelChange?.(millis)
  }, [active, millis, onLabelChange])

  if (active !== true || !Number.isFinite(millis)) return null

  const labelText = new Date(millis).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <div
      style={{
        background: '#161616',
        border: '1px solid #2a2a2a',
        borderRadius: 6,
        fontSize: 14,
        padding: '6px 10px',
        color: '#fff',
      }}
    >
      <div style={{ marginBottom: 4 }}>{labelText}</div>
      {(payload ?? []).map((p, i) => {
        const num =
          typeof p.value === 'number'
            ? p.value
            : p.value !== undefined
              ? Number(p.value)
              : NaN
        const grams = Number.isFinite(num) ? `${String(Math.round(num))}g` : '—'
        return (
          <div key={i} style={{ color: p.color ?? '#fff' }}>
            {String(p.name ?? '')}: {grams}
          </div>
        )
      })}
    </div>
  )
}

export function WeightChart({
  seriesList,
  xRange,
  yRange,
  selectedTime,
  onTimeChange,
}: WeightChartProps) {
  const now = useMemo(() => Date.now(), [])
  const wrapRef = useRef<HTMLDivElement>(null)

  // Persistent dots at the selected time so the selection remains visible
  // after the user lifts their finger (Recharts' activeDot disappears then).
  const selectedDots = useMemo(() => {
    if (selectedTime == null || !Number.isFinite(selectedTime)) return []
    return seriesList
      .filter((s) => s.points.length > 0)
      .flatMap((s) => {
        const pt = (s.points as Array<{ time: number; grams: number }>).find(
          (p) => p.time === selectedTime,
        )
        return pt !== undefined
          ? [{ kittenId: s.kittenId, color: kittenColor(s.order), y: pt.grams }]
          : []
      })
  }, [seriesList, selectedTime])

  const hasAnyPoints = seriesList.some((s) => s.points.length > 0)

  if (!hasAnyPoints) {
    return (
      <div className={styles.empty}>
        No weights recorded yet. Tap "Start weights" to begin.
      </div>
    )
  }

  // Fires on every touchstart so a selection is established even when the
  // drag begins over a chart margin or the background grid — areas where
  // Recharts' tooltip engine never activates. Converts the raw touch X to
  // an x-axis time via the known chart geometry constants and delegates to
  // the same handleTimeChange the tooltip uses. Closes GitHub issue #25.
  const handleWrapTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (onTimeChange === undefined) return
    const touch = e.touches[0]
    if (touch === undefined) return
    const rect = wrapRef.current?.getBoundingClientRect()
    if (rect === undefined) return
    // Layout constants matching LineChart margin + YAxis width below:
    //   margin.left (4) + YAxis.width (48) = 52 px
    //   margin.right = 16 px
    const PLOT_LEFT_PX = 52
    const PLOT_RIGHT_MARGIN_PX = 16
    const plotWidth = rect.width - PLOT_LEFT_PX - PLOT_RIGHT_MARGIN_PX
    if (plotWidth <= 0) return
    const touchX = touch.clientX - rect.left - PLOT_LEFT_PX
    const ratio = Math.max(0, Math.min(1, touchX / plotWidth))
    const time = xRange.min + ratio * (xRange.max - xRange.min)
    onTimeChange(time)
  }

  return (
    <div className={styles.wrap} ref={wrapRef} onTouchStart={handleWrapTouchStart}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart margin={{ top: 8, right: 16, bottom: 8, left: 4 }}>
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
            content={
              <TrackingTooltip
                {...(onTimeChange !== undefined
                  ? { onLabelChange: onTimeChange }
                  : {})}
              />
            }
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
          {selectedTime !== undefined &&
            selectedTime !== null &&
            Number.isFinite(selectedTime) &&
            selectedDots.map((dot) => (
              <ReferenceDot
                key={dot.kittenId}
                x={selectedTime}
                y={dot.y}
                r={5}
                fill={dot.color}
                stroke="#161616"
                strokeWidth={2}
                ifOverflow="extendDomain"
              />
            ))}
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
                dot={false}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
