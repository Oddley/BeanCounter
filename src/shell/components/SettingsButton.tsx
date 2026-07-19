import { Link } from 'react-router-dom'
import styles from './SettingsButton.module.css'

// Always-present AppBar entry point to /settings — separate from SyncButton
// so "check/change how sync is configured" and "sync right now" are two
// distinct, unambiguous taps.
export function SettingsButton() {
  return (
    <Link to="/settings" className={styles.button} aria-label="Settings" title="Settings">
      <span aria-hidden>⚙</span>
    </Link>
  )
}
