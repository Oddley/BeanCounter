import { Link } from 'react-router-dom'
import { useSyncState, type SyncStatus } from '../sync'
import styles from './SyncIndicator.module.css'

interface IndicatorDisplay {
  readonly icon: string
  readonly label: string
  readonly className: string
}

function displayFor(status: SyncStatus): IndicatorDisplay {
  switch (status) {
    case 'offline':
      return {
        icon: '⚙',
        label: 'Drive sync not configured — tap to set up',
        className: styles.offline ?? '',
      }
    case 'syncing':
      return {
        icon: '⟳',
        label: 'Syncing to Drive…',
        className: styles.syncing ?? '',
      }
    case 'error':
      return {
        icon: '!',
        label: 'Sync failed — changes saved locally',
        className: styles.error ?? '',
      }
    case 'dirty':
      return {
        icon: '●',
        label: 'Unpublished local changes',
        className: styles.dirty ?? '',
      }
    case 'synced':
      return {
        icon: '✓',
        label: 'Synced to Drive',
        className: styles.synced ?? '',
      }
  }
}

export function SyncIndicator() {
  const state = useSyncState()
  const display = displayFor(state.status)
  return (
    <Link
      to="/settings"
      className={`${styles.indicator} ${display.className}`}
      aria-label={display.label}
      title={display.label}
    >
      <span aria-hidden>{display.icon}</span>
    </Link>
  )
}
