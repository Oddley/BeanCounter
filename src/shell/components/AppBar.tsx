import { useNavigate } from 'react-router-dom'
import { useNavDepth } from '../app/NavDepthProvider'
import { SyncIndicator } from './SyncIndicator'
import styles from './AppBar.module.css'

export interface AppBarProps {
  readonly title: string
  readonly backTo?: string
}

export function AppBar({ title, backTo }: AppBarProps) {
  const navigate = useNavigate()
  const navDepth = useNavDepth()

  const handleBack = () => {
    // navDepth counts net PUSH navigations since app launch (PUSH +1,
    // POP -1, REPLACE ±0). It is always 0 on cold launch and correctly
    // decrements on every system-back, so it reflects the real position
    // in the stack rather than the total stack size (history.length) or
    // saved state (location.key) — both of which Chrome can restore to
    // misleading values after a PWA cold launch.
    if (navDepth > 0) {
      navigate(-1)
    } else if (backTo !== undefined) {
      navigate(backTo, { replace: true })
    }
  }

  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        {backTo !== undefined && (
          <button
            type="button"
            onClick={handleBack}
            className={styles.back}
            aria-label="Back"
          >
            ‹
          </button>
        )}
      </div>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.right}>
        <SyncIndicator />
      </div>
    </header>
  )
}
