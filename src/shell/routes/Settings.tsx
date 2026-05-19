import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppBar, Button } from '../components'
import {
  isAuthConfigured,
  isPickerConfigured,
  requestToken,
  pickFolder,
  setStoredFolder,
  clearStoredFolder,
  getStoredFolderId,
  getStoredFolderName,
} from '../auth'
import { DriveError } from '../drive'
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
import { usePwaStatus, applyPendingUpdate } from '../pwa'
import styles from './Settings.module.css'

// Invite UX state: brief notices after Mama performs each step
// (opening the Drive share dialog or copying/sharing the link).
type InviteNotice =
  | { kind: 'idle' }
  | { kind: 'link-copied' }
  | { kind: 'dialog-opened' }
  | { kind: 'shared-link' }
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
  const pwaStatus = usePwaStatus()
  const [step, setStep] = useState<Step>({ kind: 'idle' })
  const [inviteNotice, setInviteNotice] = useState<InviteNotice>({
    kind: 'idle',
  })
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

  // Build the invite URL once per render. It only depends on stable
  // stored-folder state, and we use it in three places (copy, share,
  // display).
  const inviteUrl = (() => {
    const folderId = getStoredFolderId()
    const folderName = getStoredFolderName()
    if (folderId === null || folderName === null) return null
    return buildInviteUrl({
      origin: window.location.origin,
      folderId,
      folderName,
    })
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

  const handleOpenFolderInDrive = async () => {
    const folderId = getStoredFolderId()
    if (folderId === null) {
      setInviteNotice({
        kind: 'error',
        message: 'Connect to a folder before inviting others.',
      })
      return
    }
    // Copy the invite link to clipboard FIRST so Mama can paste it
    // wherever (Drive's optional message field, a text message, etc.).
    const copied = await copyInviteLink()
    // Open Drive's web UI to the folder. From there Mama uses Drive's
    // native Share button (top right) to grant access. We tried the
    // embedded ShareClient widget but it's deprecated and shows
    // 'Sorry sharing is not available' to non-GCP-member users.
    const driveUrl = `https://drive.google.com/drive/folders/${folderId}`
    window.open(driveUrl, '_blank', 'noopener,noreferrer')
    setInviteNotice(
      copied ? { kind: 'link-copied' } : { kind: 'dialog-opened' },
    )
  }

  const handleShareInviteLink = async () => {
    if (inviteUrl === null) return
    const folderName = getStoredFolderName() ?? 'this Bean Counter household'
    const shareData = {
      title: 'Bean Counter invite',
      text: `Join "${folderName}" on Bean Counter to share kitten weights:`,
      url: inviteUrl,
    }
    // Web Share API isn't universal — fall back to clipboard if
    // navigator.share is missing or the user cancels (which throws
    // AbortError, not a real failure to surface).
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData)
        setInviteNotice({ kind: 'shared-link' })
        return
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        // Fall through to clipboard fallback on other failures
      }
    }
    const copied = await copyInviteLink()
    setInviteNotice(
      copied
        ? { kind: 'link-copied' }
        : {
            kind: 'error',
            message: "Couldn't share or copy. Long-press the link to copy.",
          },
    )
  }

  // Void-wrapping onClick handlers so the JSX prop type stays
  // void-returning (matches the project's existing pattern in
  // Invite.tsx etc.).
  const onOpenFolderInDrive = () => {
    void handleOpenFolderInDrive()
  }
  const onShareInviteLink = () => {
    void handleShareInviteLink()
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
                    Sync now after a fresh launch to refresh the OAuth
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
                    <p className={styles.conflictsBanner}>
                      ⚠ {syncState.conflictCount} sync conflict
                      {syncState.conflictCount === 1 ? '' : 's'} unresolved
                      —{' '}
                      <Link to="/conflicts" className={styles.conflictsLink}>
                        review and pick a side
                      </Link>
                    </p>
                  )}
                  <p className={styles.muted}>
                    Sync runs on every navigation when you have unpublished
                    changes, and on app start. Tap Sync now to force a
                    sync — it also re-runs sign-in if your session has
                    expired.
                  </p>
                  <div className={styles.connectedButtons}>
                    <Button onClick={handleSyncNow}>Sync now</Button>
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
                    onClick={handleFreshConnect}
                    className={styles.connectButton}
                  >
                    Try again
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        {fullyConfigured && step.kind === 'connected' && inviteUrl !== null && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Invite a caregiver</h2>
            <p className={styles.muted}>
              Share this household with another foster caregiver. Both
              devices will sync the same data. Inviting takes two pieces —
              they can be done in any order:
            </p>

            <ol className={styles.inviteSteps}>
              <li>
                <strong>Share the Drive folder</strong> so they can access
                its data.{' '}
                <span className={styles.muted}>
                  Tapping below opens the folder in Drive (in a new tab)
                  and copies the invite link to your clipboard. Use
                  Drive&apos;s Share button to add their email — paste
                  the link into the &quot;Message&quot; field there if
                  you want it delivered in the same email.
                </span>
              </li>
              <li>
                <strong>Send them the invite link</strong> so Bean Counter
                knows what folder to sync to. You can use Drive&apos;s
                message field (above) or send it any other way.
              </li>
            </ol>

            <div className={styles.inviteButtons}>
              <Button onClick={onOpenFolderInDrive}>
                Open folder in Drive
              </Button>
              <Button variant="secondary" onClick={onShareInviteLink}>
                Share invite link…
              </Button>
            </div>

            {inviteNotice.kind === 'link-copied' && (
              <p className={styles.success}>
                ✓ Invite link copied to clipboard. Paste it into Drive&apos;s
                message field, a text to your caregiver, or wherever.
              </p>
            )}
            {inviteNotice.kind === 'dialog-opened' && (
              <p className={styles.muted}>
                Drive opened in a new tab. Couldn&apos;t auto-copy the link;
                tap Copy invite link to copy it manually.
              </p>
            )}
            {inviteNotice.kind === 'shared-link' && (
              <p className={styles.success}>✓ Invite link shared.</p>
            )}
            {inviteNotice.kind === 'error' && (
              <p className={styles.error}>{inviteNotice.message}</p>
            )}
          </section>
        )}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>App version</h2>
          {pwaStatus.registrationError !== null && (
            <p className={styles.error}>
              Couldn&apos;t check for updates: {pwaStatus.registrationError}
            </p>
          )}
          {pwaStatus.registrationError === null &&
            pwaStatus.needsRefresh && (
              <>
                <p className={styles.dirtyBanner}>
                  ● A new version is ready. Reload to apply it.
                </p>
                <Button onClick={applyPendingUpdate} className={styles.connectButton}>
                  Reload to update
                </Button>
              </>
            )}
          {pwaStatus.registrationError === null &&
            !pwaStatus.needsRefresh &&
            pwaStatus.registeredAt === 0 && (
              <p className={styles.muted}>Checking for updates…</p>
            )}
          {pwaStatus.registrationError === null &&
            !pwaStatus.needsRefresh &&
            pwaStatus.registeredAt > 0 && (
              <p className={styles.muted}>
                ✓ Up to date — last checked{' '}
                {formatRelative(pwaStatus.lastCheckedAt)}.
              </p>
            )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Feedback</h2>
          <p className={styles.muted}>
            Hit a bug or have an idea? Filing an issue on GitHub helps us
            keep track and respond.
          </p>
          <div className={styles.feedbackButtons}>
            <Button
              variant="secondary"
              onClick={() => {
                window.open(
                  'https://github.com/Oddley/BeanCounter/issues/new?template=bug_report.yml',
                  '_blank',
                  'noopener,noreferrer',
                )
              }}
            >
              Report a bug
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                window.open(
                  'https://github.com/Oddley/BeanCounter/issues/new?template=feature_request.yml',
                  '_blank',
                  'noopener,noreferrer',
                )
              }}
            >
              Request a feature
            </Button>
          </div>
        </section>

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
  status:
    | 'offline'
    | 'syncing'
    | 'error'
    | 'conflicts'
    | 'dirty'
    | 'synced',
): string {
  switch (status) {
    case 'offline':
      return 'Not connected'
    case 'syncing':
      return 'Syncing…'
    case 'error':
      return 'Sync failed'
    case 'conflicts':
      return 'Sync conflicts'
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
