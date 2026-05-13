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
    case 'unconnected':
      return {
        icon: '⊘',
        label: 'Not connected to Drive',
        className: styles.unconnected ?? '',
      }
    case 'pending':
      return {
        icon: '⋯',
        label: 'Sync pending',
        className: styles.pending ?? '',
      }
    case 'synced':
      return {
        icon: '✓',
        label: 'Synced',
        className: styles.synced ?? '',
      }
    case 'error':
      return { icon: '!', label: 'Sync error', className: styles.error ?? '' }
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
