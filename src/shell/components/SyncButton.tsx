import { Link } from 'react-router-dom'
import { useSyncState, useActiveBackendKind, triggerManualSync, type SyncStatus } from '../sync'
import styles from './SyncButton.module.css'

interface Display {
  readonly icon: string
  readonly label: string
  readonly className: string
}

function displayFor(status: SyncStatus, backendName: string): Display {
  const to = backendName !== '' ? ` to ${backendName}` : ''
  switch (status) {
    case 'syncing':
      return { icon: '⟳', label: `Syncing${to}…`, className: styles.syncing ?? '' }
    case 'error':
      return { icon: '!', label: 'Sync failed — tap to retry', className: styles.error ?? '' }
    case 'dirty':
      return { icon: '●', label: 'Unpublished local changes — tap to sync now', className: styles.dirty ?? '' }
    case 'synced':
      return { icon: '✓', label: `Synced${to} — tap to sync now`, className: styles.synced ?? '' }
    // 'offline' and 'conflicts' are handled by the caller before displayFor runs.
    case 'offline':
    case 'conflicts':
      return { icon: '', label: '', className: '' }
  }
}

// AppBar sync control. Hidden entirely when sync isn't configured (offline) —
// there's nothing to trigger yet; use Settings to set it up. Shows a live
// status glyph the rest of the time; tapping it fires a sync immediately,
// except in 'conflicts' where it instead routes to the resolution screen.
export function SyncButton() {
  const state = useSyncState()
  const backendKind = useActiveBackendKind()
  const backendName =
    backendKind === 'drive' ? 'Drive'
    : backendKind === 'firebase' ? 'Firebase'
    : ''

  if (state.status === 'offline') return null

  if (state.status === 'conflicts') {
    return (
      <Link
        to="/conflicts"
        className={`${styles.button} ${styles.conflicts ?? ''}`}
        aria-label="Sync conflicts — tap to resolve"
        title="Sync conflicts — tap to resolve"
      >
        <span aria-hidden>⚠</span>
      </Link>
    )
  }

  const display = displayFor(state.status, backendName)
  const busy = state.status === 'syncing'

  return (
    <button
      type="button"
      className={`${styles.button} ${display.className}`}
      aria-label={display.label}
      title={display.label}
      disabled={busy}
      onClick={triggerManualSync}
    >
      <span aria-hidden>{display.icon}</span>
    </button>
  )
}
