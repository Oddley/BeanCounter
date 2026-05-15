import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppBar, Button } from '../components'
import {
  isAuthConfigured,
  isPickerConfigured,
  requestToken,
  getValidToken,
  pickFolder,
  setStoredFolder,
  clearStoredFolder,
  getStoredFolderId,
  getStoredFolderName,
} from '../auth'
import { DriveError, sharePermission } from '../drive'
import {
  setSyncState,
  useSyncState,
  inspectDrive,
  pushLocalToActive,
  pullActiveToLocal,
  hasAnyLocalData,
  runSync,
  type InspectionResult,
} from '../sync'
import { buildInviteUrl } from '../../core/invite'
import styles from './Settings.module.css'

type InviteState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'success'; email: string }
  | { kind: 'error'; message: string }

type Step =
  | { kind: 'idle' }
  | { kind: 'disconnected' }
  | { kind: 'connected'; folderName: string }
  | { kind: 'connecting' }
  | { kind: 'picking'; accessToken: string }
  | {
      kind: 'inspecting'
      accessToken: string
      folderId: string
      folderName: string
    }
  | {
      kind: 'ready-push'
      accessToken: string
      folderId: string
      folderName: string
    }
  | {
      kind: 'confirm-pull'
      accessToken: string
      folderId: string
      folderName: string
      inspection: Extract<InspectionResult, { kind: 'exists' }>
    }
  | { kind: 'pushing'; folderName: string }
  | { kind: 'pulling'; folderName: string }
  | {
      kind: 'synced'
      mode: 'pushed' | 'pulled'
      folderName: string
    }
  | { kind: 'error'; message: string }

export function Settings() {
  const syncState = useSyncState()
  const [step, setStep] = useState<Step>({ kind: 'idle' })
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteState, setInviteState] = useState<InviteState>({ kind: 'idle' })
  const authConfigured = isAuthConfigured()
  const pickerConfigured = isPickerConfigured()
  const fullyConfigured = authConfigured && pickerConfigured

  // On mount: if a folder is already stored, land in the connected state.
  useEffect(() => {
    if (!fullyConfigured) return
    const storedName = getStoredFolderName()
    if (storedName !== null) {
      setStep({ kind: 'connected', folderName: storedName })
    } else {
      setStep({ kind: 'disconnected' })
    }
  }, [fullyConfigured])

  const handleError = (err: unknown) => {
    const message =
      err instanceof DriveError
        ? `Drive API error (${String(err.status)}): ${err.message}`
        : err instanceof Error
          ? err.message
          : 'Unknown error'
    setSyncState({ status: 'error', errorMessage: message })
    setStep({ kind: 'error', message })
  }

  // Shared post-folder flow: given a token + folder, inspect Drive and
  // branch into push / silent-pull / warn-then-pull.
  const inspectAndBranch = async (
    accessToken: string,
    folderId: string,
    folderName: string,
  ) => {
    setStep({ kind: 'inspecting', accessToken, folderId, folderName })
    const inspection = await inspectDrive(accessToken, folderId)
    if (inspection.kind === 'empty') {
      setStep({ kind: 'ready-push', accessToken, folderId, folderName })
    } else if (inspection.kind === 'exists') {
      const localHasData = await hasAnyLocalData()
      if (!localHasData) {
        setStep({ kind: 'pulling', folderName })
        await pullActiveToLocal(inspection.file)
        setSyncState({ status: 'synced', errorMessage: '' })
        setStep({ kind: 'synced', mode: 'pulled', folderName })
      } else {
        setStep({
          kind: 'confirm-pull',
          accessToken,
          folderId,
          folderName,
          inspection,
        })
      }
    } else {
      setSyncState({ status: 'error', errorMessage: inspection.error })
      setStep({
        kind: 'error',
        message: `Drive's active.json is unreadable: ${inspection.error}`,
      })
    }
  }

  // Fresh connect: pick a folder via the Picker, then inspect+branch.
  const handleFreshConnect = async () => {
    setStep({ kind: 'connecting' })
    setSyncState({ status: 'syncing', errorMessage: '' })
    try {
      const token = await requestToken()
      setStep({ kind: 'picking', accessToken: token.accessToken })
      const folder = await pickFolder(token.accessToken)
      if (folder === null) {
        setStep({ kind: 'disconnected' })
        setSyncState({ status: 'offline', errorMessage: '' })
        return
      }
      setStoredFolder(folder.id, folder.name)
      await inspectAndBranch(token.accessToken, folder.id, folder.name)
    } catch (err) {
      handleError(err)
    }
  }

  // Reconnect: re-auth (in response to user tap so popup is allowed),
  // but skip the Picker — use the stored folder.
  const handleReconnect = async () => {
    const storedId = getStoredFolderId()
    const storedName = getStoredFolderName()
    if (storedId === null || storedName === null) {
      await handleFreshConnect()
      return
    }
    setStep({ kind: 'connecting' })
    setSyncState({ status: 'syncing', errorMessage: '' })
    try {
      const token = await requestToken()
      await inspectAndBranch(token.accessToken, storedId, storedName)
    } catch (err) {
      handleError(err)
    }
  }

  const handlePushLocal = async () => {
    if (step.kind !== 'ready-push') return
    setStep({ kind: 'pushing', folderName: step.folderName })
    setSyncState({ status: 'syncing', errorMessage: '' })
    try {
      await pushLocalToActive(step.accessToken, step.folderId)
      setSyncState({ status: 'synced', errorMessage: '' })
      setStep({
        kind: 'synced',
        mode: 'pushed',
        folderName: step.folderName,
      })
    } catch (err) {
      handleError(err)
    }
  }

  const handleConfirmReplaceLocal = async () => {
    if (step.kind !== 'confirm-pull') return
    setStep({ kind: 'pulling', folderName: step.folderName })
    setSyncState({ status: 'syncing', errorMessage: '' })
    try {
      await pullActiveToLocal(step.inspection.file)
      setSyncState({ status: 'synced', errorMessage: '' })
      setStep({
        kind: 'synced',
        mode: 'pulled',
        folderName: step.folderName,
      })
    } catch (err) {
      handleError(err)
    }
  }

  const handleCancelPull = () => {
    clearStoredFolder()
    setStep({ kind: 'disconnected' })
    setSyncState({ status: 'offline', errorMessage: '' })
  }

  const handleReset = () => {
    clearStoredFolder()
    setStep({ kind: 'disconnected' })
    setSyncState({ status: 'offline', errorMessage: '' })
  }

  const handleSendInvite = async () => {
    const folderId = getStoredFolderId()
    const folderName = getStoredFolderName()
    if (folderId === null || folderName === null) {
      setInviteState({
        kind: 'error',
        message: 'Connect to a folder before inviting others.',
      })
      return
    }
    const email = inviteEmail.trim()
    if (!email.includes('@') || email.length < 3) {
      setInviteState({
        kind: 'error',
        message: 'Enter a valid email address.',
      })
      return
    }

    setInviteState({ kind: 'sending' })
    try {
      // Prefer the cached token from the existing session — that token
      // carries the per-file authorization granted when the user
      // originally picked the folder via the Picker. A fresh
      // requestToken() issues a new token that, in practice, lacks that
      // per-file access list and gets a 404 from permissions endpoints.
      // Fall back to requestToken (with its consent popup) only if the
      // cached token is missing or expired.
      let token = await getValidToken()
      if (token === null) {
        const fresh = await requestToken()
        token = fresh.accessToken
      }
      const inviteUrl = buildInviteUrl({
        origin: window.location.origin,
        folderId,
        folderName,
      })
      const message =
        `You've been invited to share a Bean Counter household.\n\n` +
        `To accept, tap this link on your phone:\n${inviteUrl}\n\n` +
        `Sign in with this Google account (the one this email was sent to).`
      await sharePermission(token, {
        fileId: folderId,
        email,
        emailMessage: message,
        role: 'writer',
      })
      setInviteState({ kind: 'success', email })
      setInviteEmail('')
    } catch (err) {
      const errorMessage =
        err instanceof DriveError
          ? `Drive API error (${String(err.status)}): ${err.message}`
          : err instanceof Error
            ? err.message
            : 'Unknown error'
      setInviteState({ kind: 'error', message: errorMessage })
    }
  }

  const handleSyncNow = async () => {
    // Sync now IS a user gesture, so we allow interactive auth fallback.
    // If silent token refresh fails (cross-session, third-party-cookie
    // blocked, etc.), GSI's consent popup runs and unblocks the sync.
    await runSync({ allowInteractive: true })
    // runSync updates syncState directly; refresh our step view.
    const storedName = getStoredFolderName()
    if (storedName !== null) {
      setStep({ kind: 'connected', folderName: storedName })
    }
  }

  return (
    <>
      <AppBar title="Settings" backTo="/" />
      <main className={styles.main}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Google Drive Sync</h2>

          {!fullyConfigured && (
            <div className={styles.notConfigured}>
              <p>
                <strong>Drive sync is not fully configured.</strong>
              </p>
              <p className={styles.muted}>
                {!authConfigured && (
                  <>
                    <code>VITE_GOOGLE_CLIENT_ID</code> is empty.{' '}
                  </>
                )}
                {!pickerConfigured && (
                  <>
                    <code>VITE_GOOGLE_API_KEY</code> is empty.{' '}
                  </>
                )}
                See <code>docs/SETUP-DRIVE.md</code> for the Google Cloud
                Console steps.
              </p>
            </div>
          )}

          {fullyConfigured && (
            <>
              <p className={styles.statusLine}>
                Status:{' '}
                <strong className={styles[syncState.status]}>
                  {labelFor(syncState.status)}
                </strong>
              </p>
              {syncState.errorMessage !== '' && (
                <p className={styles.error}>{syncState.errorMessage}</p>
              )}

              {step.kind === 'idle' && (
                <p className={styles.muted}>Loading…</p>
              )}

              {step.kind === 'disconnected' && (
                <Button
                  onClick={handleFreshConnect}
                  className={styles.connectButton}
                >
                  Connect to Google Drive
                </Button>
              )}

              {step.kind === 'connecting' && (
                <p className={styles.muted}>Authenticating…</p>
              )}

              {step.kind === 'picking' && (
                <p className={styles.muted}>Waiting for folder selection…</p>
              )}

              {step.kind === 'inspecting' && (
                <p className={styles.muted}>
                  Checking <strong>{step.folderName}</strong>…
                </p>
              )}

              {step.kind === 'ready-push' && (
                <div>
                  <p>
                    <strong>{step.folderName}</strong> is empty. Click below to
                    push your local data and set up Bean Counter in that
                    folder.
                  </p>
                  <Button
                    onClick={handlePushLocal}
                    className={styles.connectButton}
                  >
                    Push local data to Drive
                  </Button>
                </div>
              )}

              {step.kind === 'confirm-pull' && (
                <div className={styles.warning}>
                  <p>
                    <strong>
                      ⚠ {step.folderName} already has Bean Counter data.
                    </strong>
                  </p>
                  <p>
                    Connecting will <strong>replace your local data</strong>{' '}
                    with what's in Drive. Your local litters, kittens,
                    sessions, and weights will be lost.
                  </p>
                  <p className={styles.muted}>
                    Drive's active.json contains{' '}
                    {step.inspection.file.litters.length} litter
                    {step.inspection.file.litters.length === 1 ? '' : 's'} and{' '}
                    {step.inspection.file.kittens.length} kitten
                    {step.inspection.file.kittens.length === 1 ? '' : 's'}.
                  </p>
                  <div className={styles.warningButtons}>
                    <Button
                      variant="danger"
                      onClick={handleConfirmReplaceLocal}
                    >
                      Replace local with Drive
                    </Button>
                    <Button variant="secondary" onClick={handleCancelPull}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {step.kind === 'pushing' && (
                <p className={styles.muted}>
                  Pushing local data to <strong>{step.folderName}</strong>…
                </p>
              )}

              {step.kind === 'pulling' && (
                <p className={styles.muted}>
                  Pulling data from <strong>{step.folderName}</strong>…
                </p>
              )}

              {step.kind === 'synced' && (
                <div>
                  <p className={styles.success}>
                    {step.mode === 'pushed'
                      ? `✓ Local data pushed to ${step.folderName}.`
                      : `✓ Pulled data from ${step.folderName}.`}
                  </p>
                  <p className={styles.muted}>
                    Connected to <strong>{step.folderName}</strong>. The
                    folder selection persists across app launches; tap
                    Reconnect after a fresh launch to refresh the OAuth
                    session.
                  </p>
                  <Button variant="secondary" onClick={handleReset}>
                    Disconnect / choose different folder
                  </Button>
                </div>
              )}

              {step.kind === 'connected' && (
                <div>
                  <p>
                    Connected to <strong>{step.folderName}</strong>.
                  </p>
                  {syncState.status === 'dirty' && (
                    <p className={styles.dirtyBanner}>
                      ● You have unpublished local changes. They&apos;ll
                      publish on the next navigation, or tap Sync now.
                    </p>
                  )}
                  {syncState.status === 'error' && (
                    <p className={styles.errorBanner}>
                      ! Last sync failed — your changes are saved on this
                      device only. Tap Sync now to try again.
                    </p>
                  )}
                  {syncState.lastSyncedAt > 0 && (
                    <p className={styles.muted}>
                      Last synced: {formatRelative(syncState.lastSyncedAt)}
                    </p>
                  )}
                  {syncState.conflictCount > 0 && (
                    <p className={styles.error}>
                      ⚠ {syncState.conflictCount} merge conflict
                      {syncState.conflictCount === 1 ? '' : 's'} on the last
                      sync. Conflict-resolution UI lands in Phase 4.5.
                    </p>
                  )}
                  <p className={styles.muted}>
                    Sync runs on every navigation when you have unpublished
                    changes, and on app start. Tap Sync now to force a
                    sync, or Reconnect if the session expired.
                  </p>
                  <div className={styles.connectedButtons}>
                    <Button onClick={handleSyncNow}>Sync now</Button>
                    <Button variant="secondary" onClick={handleReconnect}>
                      Reconnect
                    </Button>
                    <Button variant="secondary" onClick={handleReset}>
                      Disconnect / choose different folder
                    </Button>
                  </div>
                </div>
              )}

              {step.kind === 'error' && (
                <div>
                  <p className={styles.error}>{step.message}</p>
                  <Button
                    onClick={handleReconnect}
                    className={styles.connectButton}
                  >
                    Try again
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        {fullyConfigured && step.kind === 'connected' && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Invite a caregiver</h2>
            <p className={styles.muted}>
              Share this household with another foster caregiver. They&apos;ll
              receive an email from Google with a link to join. Both devices
              will sync the same data.
            </p>
            <label className={styles.inviteLabel}>
              Their email address
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value)
                  if (inviteState.kind !== 'idle') {
                    setInviteState({ kind: 'idle' })
                  }
                }}
                disabled={inviteState.kind === 'sending'}
                placeholder="caregiver@example.com"
                className={styles.inviteInput}
              />
            </label>
            <Button
              onClick={handleSendInvite}
              disabled={
                inviteState.kind === 'sending' || inviteEmail.trim() === ''
              }
              className={styles.inviteButton}
            >
              {inviteState.kind === 'sending' ? 'Sending…' : 'Send invite'}
            </Button>
            {inviteState.kind === 'success' && (
              <p className={styles.success}>
                ✓ Invite sent to <strong>{inviteState.email}</strong>. They
                should check their email (including spam) for a message from
                Google Drive with a link.
              </p>
            )}
            {inviteState.kind === 'error' && (
              <p className={styles.error}>{inviteState.message}</p>
            )}
          </section>
        )}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Diagnostics</h2>
          <Link to="/debug" className={styles.diagnosticLink}>
            Debug — raw Dexie state, seed demo data, wipe all data
          </Link>
        </section>
      </main>
    </>
  )
}

function labelFor(
  status: 'offline' | 'syncing' | 'error' | 'dirty' | 'synced',
): string {
  switch (status) {
    case 'offline':
      return 'Not connected'
    case 'syncing':
      return 'Syncing…'
    case 'error':
      return 'Sync failed'
    case 'dirty':
      return 'Unpublished changes'
    case 'synced':
      return 'Synced'
  }
}

function formatRelative(millis: number): string {
  const diff = Date.now() - millis
  if (diff < 0) return 'in the future'
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${String(seconds)}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${String(minutes)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)}h ago`
  const days = Math.floor(hours / 24)
  return `${String(days)}d ago`
}
