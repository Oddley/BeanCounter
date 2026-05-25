import { useNavigate } from 'react-router-dom'
import { SyncIndicator } from './SyncIndicator'
import styles from './AppBar.module.css'

export interface AppBarProps {
  readonly title: string
  readonly backTo?: string
}

export function AppBar({ title, backTo }: AppBarProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    // window.history.length > 1 means there is at least one prior entry
    // to pop. On a PWA cold launch Chrome restores the page's
    // history.state (making location.key non-'default') but does NOT
    // restore the full stack, so history.length is 1 and navigate(-1)
    // silently fails. history.length is the reliable indicator.
    if (window.history.length > 1) {
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
