import { Link } from 'react-router-dom'
import { useSyncState, useActiveBackendKind, type SyncStatus } from '../sync'
import styles from './SyncIndicator.module.css'

interface IndicatorDisplay {
  readonly icon: string
  readonly label: string
  readonly className: string
  // Tap target: indicators normally land in /settings, but the
  // 'conflicts' state has its own resolution route.
  readonly href: string
}

function displayFor(status: SyncStatus, backendName: string): IndicatorDisplay {
  const to = backendName !== '' ? ` to ${backendName}` : ''
  switch (status) {
    case 'offline':
      return {
        icon: '⚙',
        label: 'Sync not configured — tap to set up',
        className: styles.offline ?? '',
        href: '/settings',
      }
    case 'syncing':
      return {
        icon: '⟳',
        label: `Syncing${to}…`,
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
        label: `Synced${to}`,
        className: styles.synced ?? '',
        href: '/settings',
      }
  }
}

export function SyncIndicator() {
  const state = useSyncState()
  const backendKind = useActiveBackendKind()
  // Map kind to display name without importing the full backend instance.
  const backendName =
    backendKind === 'drive' ? 'Drive'
    : backendKind === 'firebase' ? 'Firebase'
    : ''
  const display = displayFor(state.status, backendName)
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
