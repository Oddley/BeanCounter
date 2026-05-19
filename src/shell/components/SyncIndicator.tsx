import { Link } from 'react-router-dom'
import { useSyncState, type SyncStatus } from '../sync'
import styles from './SyncIndicator.module.css'

interface IndicatorDisplay {
  readonly icon: string
  readonly label: string
  readonly className: string
  // Tap target: indicators normally land in /settings, but the
  // 'conflicts' state has its own resolution route.
  readonly href: string
}

function displayFor(status: SyncStatus): IndicatorDisplay {
  switch (status) {
    case 'offline':
      return {
        icon: '⚙',
        label: 'Drive sync not configured — tap to set up',
        className: styles.offline ?? '',
        href: '/settings',
      }
    case 'syncing':
      return {
        icon: '⟳',
        label: 'Syncing to Drive…',
        className: styles.syncing ?? '',
        href: '/settings',
      }
    case 'error':
      return {
        icon: '!',
        label: 'Sync failed — changes saved locally',
        className: styles.error ?? '',
        href: '/settings',
      }
    case 'conflicts':
      return {
        icon: '⚠',
        label: 'Sync conflicts — tap to resolve',
        className: styles.conflicts ?? '',
        href: '/conflicts',
      }
    case 'dirty':
      return {
        icon: '●',
        label: 'Unpublished local changes',
        className: styles.dirty ?? '',
        href: '/settings',
      }
    case 'synced':
      return {
        icon: '✓',
        label: 'Synced to Drive',
        className: styles.synced ?? '',
        href: '/settings',
      }
  }
}

export function SyncIndicator() {
  const state = useSyncState()
  const display = displayFor(state.status)
  return (
    <Link
      to={display.href}
      className={`${styles.indicator} ${display.className}`}
      aria-label={display.label}
      title={display.label}
    >
      <span aria-hidden>{display.icon}</span>
    </Link>
  )
}
