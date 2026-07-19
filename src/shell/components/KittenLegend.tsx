import { type KittenSeries } from '../../core/graph'
import { gramsToOunces } from '../../core/weight'
import styles from './KittenLegend.module.css'

const FALLBACK_COLOR = '#f5b400'

export interface KittenLegendProps {
  readonly seriesList: readonly KittenSeries[]
  // Resolved plotted color per kittenId — see core/graph resolveSeriesColors.
  readonly colors: ReadonlyMap<string, string>
  readonly focusedKittenId: string | null
  readonly onToggleFocus: (kittenId: string) => void
  readonly unit?: 'g' | 'oz'
  // When a feeding is selected on the chart, shows each kitten's weight
  // for that session next to its name so the user can read values after
  // lifting their finger (Recharts' tooltip disappears on touch-end).
  // Closes GitHub issue #26.
  readonly selectedWeights?: ReadonlyMap<string, number>
}

export function KittenLegend({
  seriesList,
  colors,
  focusedKittenId,
  onToggleFocus,
  unit = 'g',
  selectedWeights,
}: KittenLegendProps) {
  if (seriesList.length === 0) return null

  return (
    <ul className={styles.list}>
      {seriesList.map((s) => {
        const isFocused = focusedKittenId === s.kittenId
        const isDimmed = focusedKittenId !== null && !isFocused
        const className = [
          styles.chip,
          isFocused ? styles.focused : '',
          isDimmed ? styles.dimmed : '',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <li key={s.kittenId}>
            <button
              type="button"
              className={className}
              onClick={() => onToggleFocus(s.kittenId)}
              aria-pressed={isFocused}
            >
              <span
                className={styles.swatch}
                style={{ backgroundColor: colors.get(s.kittenId) ?? FALLBACK_COLOR }}
                aria-hidden
              />
              <span className={styles.name}>{s.displayName}</span>
              {selectedWeights !== undefined &&
                selectedWeights.has(s.kittenId) && (
                  <span className={styles.weight}>
                    {unit === 'oz'
                      ? `${gramsToOunces(selectedWeights.get(s.kittenId) as number).toFixed(1)}oz`
                      : `${Math.round(selectedWeights.get(s.kittenId) as number)}g`}
                  </span>
                )}
              {s.points.length === 0 && (
                <span className={styles.noData}>no data</span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
