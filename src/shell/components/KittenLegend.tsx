import { type KittenSeries } from '../../core/graph'
import { kittenColor } from './WeightChart'
import styles from './KittenLegend.module.css'

export interface KittenLegendProps {
  readonly seriesList: readonly KittenSeries[]
  readonly focusedKittenId: string | null
  readonly onToggleFocus: (kittenId: string) => void
}

export function KittenLegend({
  seriesList,
  focusedKittenId,
  onToggleFocus,
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
                style={{ backgroundColor: kittenColor(s.order) }}
                aria-hidden
              />
              <span className={styles.name}>{s.displayName}</span>
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
