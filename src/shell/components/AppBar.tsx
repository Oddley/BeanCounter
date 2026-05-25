import { useNavigate, useLocation } from 'react-router-dom'
import { SyncIndicator } from './SyncIndicator'
import styles from './AppBar.module.css'

export interface AppBarProps {
  readonly title: string
  readonly backTo?: string
}

export function AppBar({ title, backTo }: AppBarProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleBack = () => {
    // location.key is 'default' only when the app opened cold to this
    // page with no prior history entry. In that case fall back to the
    // semantic backTo target so the button always goes somewhere useful.
    if (location.key !== 'default') {
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
