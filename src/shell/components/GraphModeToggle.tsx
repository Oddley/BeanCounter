import { type GraphMode } from '../../core/graph'
import styles from './GraphModeToggle.module.css'

export interface GraphModeToggleProps {
  readonly mode: GraphMode
  readonly onChange: (mode: GraphMode) => void
}

export function GraphModeToggle({ mode, onChange }: GraphModeToggleProps) {
  return (
    <div className={styles.toggle} role="tablist" aria-label="Graph mode">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'rough'}
        className={`${styles.option} ${mode === 'rough' ? styles.selected : ''}`}
        onClick={() => onChange('rough')}
      >
        Rough
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'smooth'}
        className={`${styles.option} ${mode === 'smooth' ? styles.selected : ''}`}
        onClick={() => onChange('smooth')}
      >
        Smooth
      </button>
    </div>
  )
}
