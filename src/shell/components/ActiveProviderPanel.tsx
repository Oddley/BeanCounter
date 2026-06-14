import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from './Button'
import {
  useSyncState,
  useActiveBackendKind,
  setActiveBackend,
  runSync,
} from '../sync'
import {
  clearStoredFolder,
  getStoredFolderId,
  getStoredFolderName,
} from '../auth'
import {
  isSidecarAvailable,
  getSidecarPreferred,
  setSidecarPreferred,
} from '../sync/sidecar'
import { buildInviteUrl } from '../../core/invite'
import {
  getStoredFirebaseConfig,
  clearStoredFirebaseConfig,
} from '../auth/firebase'
import { signOutFromFirebase } from '../sync/backends/firebase'
import styles from './ActiveProviderPanel.module.css'

// ── Helpers shared across panels ─────────────────────────────────────────────

function formatRelative(millis: number): string {
  const diff = Date.now() - millis
  if (diff < 0) return 'in the future'
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${String(seconds)}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${String(minutes)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)}h ago`
  return `${String(Math.floor(hours / 24))}d ago`
}

function labelFor(status: string): string {
  switch (status) {
    case 'offline': return 'Not connected'
    case 'syncing': return 'Syncing…'
    case 'error': return 'Sync failed'
    case 'conflicts': return 'Sync conflicts'
    case 'dirty': return 'Unpublished changes'
    case 'synced': return 'Synced'
    default: return status
  }
}

function ChangeProviderLink() {
  return (
    <p className={styles.changeProvider}>
      <Link to="/setup-sync" className={styles.changeProviderLink}>
        Change sync provider
      </Link>
    </p>
  )
}

// ── Invite notice (Drive-specific) ───────────────────────────────────────────

type InviteNotice =
  | { kind: 'idle' }
  | { kind: 'link-copied' }
  | { kind: 'dialog-opened' }
  | { kind: 'shared-link' }
  | { kind: 'error'; message: string }

// ── Offline panel ─────────────────────────────────────────────────────────────

function OfflinePanel() {
  const navigate = useNavigate()
  return (
    <div>
      <p className={styles.muted}>No sync configured. Your data stays on this device only.</p>
      <Button
        onClick={() => void navigate('/setup-sync')}
        className={styles.connectButton}
      >
        Set up sync →
      </Button>
    </div>
  )
}

// ── Drive panel ───────────────────────────────────────────────────────────────

function DrivePanel() {
  const syncState = useSyncState()
  const [sidecarActive, setSidecarActive] = useState(false)
  const [sidecarPref, setSidecarPref] = useState(getSidecarPreferred)
  const [inviteNotice, setInviteNotice] = useState<InviteNotice>({ kind: 'idle' })

  const folderName = getStoredFolderName() ?? ''

  useEffect(() => {
    void isSidecarAvailable().then(setSidecarActive)
  }, [])

  const inviteUrl = (() => {
    const folderId = getStoredFolderId()
    const name = getStoredFolderName()
    if (folderId === null || name === null) return null
    return buildInviteUrl({ origin: window.location.origin, folderId, folderName: name })
  })()

  const copyInviteLink = async (): Promise<boolean> => {
    if (inviteUrl === null) return false
    try {
      await navigator.clipboard.writeText(inviteUrl)
      return true
    } catch {
      return false
    }
  }

  const handleSyncNow = () => {
    void runSync({ allowInteractive: true })
  }

  const handleDisconnect = () => {
    clearStoredFolder()
    setActiveBackend('offline')
  }

  const handleOpenFolderInDrive = async () => {
    const folderId = getStoredFolderId()
    if (folderId === null) return
    const copied = await copyInviteLink()
    window.open(`https://drive.google.com/drive/folders/${folderId}`, '_blank', 'noopener,noreferrer')
    setInviteNotice(copied ? { kind: 'link-copied' } : { kind: 'dialog-opened' })
  }

  const handleShareInviteLink = async () => {
    if (inviteUrl === null) return
    const name = getStoredFolderName() ?? 'this Bean Counter household'
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Bean Counter invite',
          text: `Join "${name}" on Bean Counter to share kitten weights:`,
          url: inviteUrl,
        })
        setInviteNotice({ kind: 'shared-link' })
        return
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
      }
    }
    const copied = await copyInviteLink()
    setInviteNotice(copied
      ? { kind: 'link-copied' }
      : { kind: 'error', message: "Couldn't share or copy. Long-press the link to copy." })
  }

  return (
    <div>
      <p>Connected to <strong>{folderName}</strong>.</p>

      {sidecarActive && (
        <p className={styles.sidecarBadge}>
          ✓ Android sync active — Drive credentials managed by the Bean Counter Sync app.
        </p>
      )}
      {!sidecarActive && sidecarPref && syncState.status !== 'synced' && (
        <p className={styles.sidecarOffline}>
          Android Sync app is not running.{' '}
          <button
            className={styles.inlineLink}
            onClick={() => { setSidecarPreferred(false); setSidecarPref(false) }}
          >
            Switch to browser sync
          </button>
        </p>
      )}

      <p className={styles.statusLine}>
        Status: <strong>{labelFor(syncState.status)}</strong>
      </p>
      {syncState.errorMessage !== '' && (
        <p className={styles.error}>{syncState.errorMessage}</p>
      )}
      {syncState.status === 'dirty' && (
        <p className={styles.dirtyBanner}>
          ● Unpublished local changes — syncs on next navigation, or tap Sync now.
        </p>
      )}
      {syncState.conflictCount > 0 && (
        <p className={styles.conflictsBanner}>
          ⚠ {syncState.conflictCount} sync conflict{syncState.conflictCount === 1 ? '' : 's'} unresolved —{' '}
          <Link to="/conflicts" className={styles.conflictsLink}>review and pick a side</Link>
        </p>
      )}
      {syncState.lastSyncedAt > 0 && (
        <p className={styles.muted}>Last synced: {formatRelative(syncState.lastSyncedAt)}</p>
      )}
      <p className={styles.muted}>
        Sync runs on every navigation when you have unpublished changes, and on app start.
      </p>

      <div className={styles.connectedButtons}>
        <Button onClick={handleSyncNow}>Sync now</Button>
        <Button variant="secondary" onClick={handleDisconnect}>
          Disconnect / choose different folder
        </Button>
      </div>

      {inviteUrl !== null && (
        <div style={{ marginTop: 'var(--space-6)' }}>
          <h3 className={styles.sectionTitle}>Invite a caregiver</h3>
          <p className={styles.muted}>
            Share this household with another foster caregiver. Both devices will sync the same data.
          </p>
          <ol className={styles.inviteSteps}>
            <li>
              <strong>Share the Drive folder</strong> — opens it in Drive and copies the invite link.
            </li>
            <li>
              <strong>Send them the invite link</strong> — paste into Drive's message field or send it any other way.
            </li>
          </ol>
          <div className={styles.inviteButtons}>
            <Button onClick={() => void handleOpenFolderInDrive()}>Open folder in Drive</Button>
            <Button variant="secondary" onClick={() => void handleShareInviteLink()}>
              Share invite link…
            </Button>
          </div>
          {inviteNotice.kind === 'link-copied' && (
            <p className={styles.success}>✓ Invite link copied to clipboard.</p>
          )}
          {inviteNotice.kind === 'dialog-opened' && (
            <p className={styles.muted}>Drive opened. Tap "Share invite link…" to copy the link manually.</p>
          )}
          {inviteNotice.kind === 'shared-link' && (
            <p className={styles.success}>✓ Invite link shared.</p>
          )}
          {inviteNotice.kind === 'error' && (
            <p className={styles.error}>{inviteNotice.message}</p>
          )}
        </div>
      )}

      <ChangeProviderLink />
    </div>
  )
}

// ── Firebase panel ────────────────────────────────────────────────────────────

function FirebasePanel() {
  const syncState = useSyncState()
  const config = getStoredFirebaseConfig()
  const projectId = config?.projectId ?? ''

  const handleSyncNow = () => {
    void runSync({ allowInteractive: true })
  }

  const handleDisconnect = async () => {
    await signOutFromFirebase()
    clearStoredFirebaseConfig()
    setActiveBackend('offline')
  }

  return (
    <div>
      <p>
        Connected to Firebase project{' '}
        <span className={styles.projectId}>{projectId}</span>.
      </p>

      <p className={styles.statusLine}>
        Status: <strong>{labelFor(syncState.status)}</strong>
      </p>
      {syncState.errorMessage !== '' && (
        <p className={styles.error}>{syncState.errorMessage}</p>
      )}
      {syncState.status === 'dirty' && (
        <p className={styles.dirtyBanner}>
          ● Unpublished local changes — syncs on next navigation, or tap Sync now.
        </p>
      )}
      {syncState.conflictCount > 0 && (
        <p className={styles.conflictsBanner}>
          ⚠ {syncState.conflictCount} sync conflict{syncState.conflictCount === 1 ? '' : 's'} unresolved —{' '}
          <Link to="/conflicts" className={styles.conflictsLink}>review and pick a side</Link>
        </p>
      )}
      {syncState.lastSyncedAt > 0 && (
        <p className={styles.muted}>Last synced: {formatRelative(syncState.lastSyncedAt)}</p>
      )}

      <div className={styles.connectedButtons}>
        <Button onClick={handleSyncNow}>Sync now</Button>
        <Button variant="secondary" onClick={() => void handleDisconnect()}>
          Sign out / disconnect
        </Button>
      </div>

      <ChangeProviderLink />
    </div>
  )
}

// ── Public component ──────────────────────────────────────────────────────────

export function ActiveProviderPanel() {
  const kind = useActiveBackendKind()

  switch (kind) {
    case 'offline':
      return <OfflinePanel />
    case 'drive':
      return <DrivePanel />
    case 'firebase':
      return <FirebasePanel />
  }
}
