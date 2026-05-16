import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppBar, Button } from '../components'
import {
  isAuthConfigured,
  isPickerConfigured,
  requestToken,
  pickActiveFile,
  setStoredFolder,
  getStoredFolderName,
} from '../auth'
import { DriveError } from '../drive'
import {
  setSyncState,
  inspectDrive,
  pullActiveToLocal,
  hasAnyLocalData,
} from '../sync'
import { parseInviteParams } from '../../core/invite'
import styles from './Invite.module.css'

// The accept-side route for multi-user invites. Mama sends foster dad
// an invite email containing a link of the form:
//
//   <origin>/invite?folderId=<id>&name=<encodedName>
//
// On arrival we show "Mama invited you to '<folderName>'", auth him in
// against Google (user gesture so the OAuth popup is allowed), then
// open the Picker into the shared folder and have him pick the
// active.json FILE (not the folder). After that, the existing
// inspectAndBranch path (also used by fresh connect) handles push /
// silent-pull / warn-then-pull.
//
// Why pick the file, not the folder: drive.file scope grants per-file
// access. Picking just the folder doesn't extend access to files
// inside that the recipient's app didn't create. If we only picked
// the folder, the listFiles query later would silently return empty
// and BC would helpfully create a SECOND active.json — leading to two
// disconnected copies in the same folder. Picking the file is the
// canonical Drive way to grant the app access to it.

type Step =
  | { kind: 'idle' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'ready'; folderId: string; folderName: string }
  | { kind: 'authenticating' }
  | { kind: 'picking'; accessToken: string }
  | { kind: 'mismatch'; expectedName: string; pickedName: string }
  | { kind: 'inspecting'; folderName: string }
  | {
      kind: 'confirm-pull'
      file: import('../../core/active-file').ActiveFile
      folderName: string
    }
  | { kind: 'success'; folderName: string }
  | { kind: 'error'; message: string }

export function Invite() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>({ kind: 'idle' })

  const authConfigured = isAuthConfigured()
  const pickerConfigured = isPickerConfigured()
  const fullyConfigured = authConfigured && pickerConfigured

  // Parse invite params on first render. Re-runs on search-param change.
  useEffect(() => {
    const parsed = parseInviteParams(searchParams)
    if (parsed.kind === 'invalid') {
      setStep({ kind: 'invalid', reason: parsed.reason })
      return
    }
    setStep({
      kind: 'ready',
      folderId: parsed.folderId,
      folderName: parsed.folderName,
    })
  }, [searchParams])

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

  const handleAccept = async () => {
    if (step.kind !== 'ready') return
    const expectedFolderId = step.folderId
    const expectedFolderName = step.folderName
    setStep({ kind: 'authenticating' })
    setSyncState({ status: 'syncing', errorMessage: '' })
    try {
      const token = await requestToken()
      setStep({ kind: 'picking', accessToken: token.accessToken })

      // Pick the active.json FILE (not the folder). With drive.file
      // scope, picking the folder doesn't grant access to files inside
      // it — Papa needs to pick the file itself so his app's scope
      // includes it. setParent in the Picker focuses the view on the
      // invited folder so he sees only its contents.
      const picked = await pickActiveFile(
        token.accessToken,
        expectedFolderId,
      )
      if (picked === null) {
        // User cancelled picker — return to ready state so they can retry.
        setStep({
          kind: 'ready',
          folderId: expectedFolderId,
          folderName: expectedFolderName,
        })
        setSyncState({ status: 'offline', errorMessage: '' })
        return
      }

      // Sanity check: did they pick a file in the inviter's folder?
      // setParent should constrain the Picker view, but the user could
      // have navigated out before picking.
      if (
        picked.parentId !== undefined &&
        picked.parentId !== expectedFolderId
      ) {
        setStep({
          kind: 'mismatch',
          expectedName: expectedFolderName,
          pickedName: picked.name,
        })
        setSyncState({ status: 'offline', errorMessage: '' })
        return
      }

      // The picked file is now in our drive.file scope. Store the
      // folder ID from the invite (we know it's correct) so the
      // orchestrator's queries can find this same file going forward.
      setStoredFolder(expectedFolderId, expectedFolderName)
      setStep({ kind: 'inspecting', folderName: expectedFolderName })
      const inspection = await inspectDrive(
        token.accessToken,
        expectedFolderId,
      )
      if (inspection.kind === 'empty') {
        // Shouldn't happen — Papa just picked active.json so the
        // listFiles query should find it. If it doesn't, something
        // unexpected is going on; surface as error rather than
        // silently creating a duplicate file (the bug this fix
        // resolves).
        setSyncState({
          status: 'error',
          errorMessage:
            "Couldn't find the file you picked. Try the invite link again.",
        })
        setStep({
          kind: 'error',
          message:
            "Picked active.json but Drive doesn't list it as a child of the invited folder. Re-try the invite link.",
        })
        return
      }
      if (inspection.kind === 'unreadable') {
        setSyncState({ status: 'error', errorMessage: inspection.error })
        setStep({
          kind: 'error',
          message: `Drive's active.json is unreadable: ${inspection.error}`,
        })
        return
      }
      // exists: prompt confirm if there's local data to overwrite.
      const localHasData = await hasAnyLocalData()
      if (localHasData) {
        setStep({
          kind: 'confirm-pull',
          file: inspection.file,
          folderName: expectedFolderName,
        })
      } else {
        await pullActiveToLocal(inspection.file)
        setSyncState({
          status: 'synced',
          errorMessage: '',
          lastSyncedAt: Date.now(),
        })
        setStep({ kind: 'success', folderName: expectedFolderName })
      }
    } catch (err) {
      handleError(err)
    }
  }

  const handleConfirmPull = async () => {
    if (step.kind !== 'confirm-pull') return
    try {
      await pullActiveToLocal(step.file)
      setSyncState({
        status: 'synced',
        errorMessage: '',
        lastSyncedAt: Date.now(),
      })
      setStep({ kind: 'success', folderName: step.folderName })
    } catch (err) {
      handleError(err)
    }
  }

  const handleGoHome = () => {
    void navigate('/')
  }

  // Wrappers: onClick attributes expect void-returning handlers, but
  // our flows are async. Wrap with `void` to acknowledge the floating
  // promise (errors are surfaced via setStep('error') inside the body).
  const onAccept = () => {
    void handleAccept()
  }
  const onConfirmPull = () => {
    void handleConfirmPull()
  }

  const currentFolderName = getStoredFolderName()

  return (
    <>
      <AppBar title="Invitation" backTo="/" />
      <main className={styles.main}>
        {!fullyConfigured && (
          <div className={styles.notConfigured}>
            <p>
              <strong>Drive sync is not fully configured on this device.</strong>
            </p>
            <p className={styles.muted}>
              See <code>docs/SETUP-DRIVE.md</code> for setup steps. Once
              configured, return to this invite link to accept.
            </p>
          </div>
        )}

        {fullyConfigured && step.kind === 'idle' && (
          <p className={styles.muted}>Loading invitation…</p>
        )}

        {fullyConfigured && step.kind === 'invalid' && (
          <div className={styles.errorPanel}>
            <p>
              <strong>This invite link is invalid.</strong>
            </p>
            <p className={styles.muted}>
              Reason: {step.reason}. Ask whoever sent the link to resend.
            </p>
            <Button variant="secondary" onClick={handleGoHome}>
              Go home
            </Button>
          </div>
        )}

        {fullyConfigured && step.kind === 'ready' && (
          <div className={styles.invitePanel}>
            <h2 className={styles.heading}>
              You&apos;ve been invited to join a Bean Counter household
            </h2>
            <p>
              Folder name: <strong>{step.folderName}</strong>
            </p>
            {currentFolderName !== null && (
              <p className={styles.warning}>
                ⚠ This device is already connected to{' '}
                <strong>{currentFolderName}</strong>. Accepting this invite
                will replace that connection. Your local data will be merged
                with the shared folder&apos;s contents (you&apos;ll be asked
                to confirm before any local data is replaced).
              </p>
            )}
            <p className={styles.muted}>
              When you tap Accept, you&apos;ll sign in to Google, then a
              picker shows the contents of the shared folder. Tap{' '}
              <strong>active.json</strong> to confirm.
            </p>
            <Button onClick={onAccept} className={styles.acceptButton}>
              Accept invitation
            </Button>
            <Button variant="secondary" onClick={handleGoHome}>
              Not now
            </Button>
          </div>
        )}

        {fullyConfigured && step.kind === 'authenticating' && (
          <p className={styles.muted}>Signing in to Google…</p>
        )}

        {fullyConfigured && step.kind === 'picking' && (
          <p className={styles.muted}>
            Pick <strong>active.json</strong> from the file picker…
          </p>
        )}

        {fullyConfigured && step.kind === 'mismatch' && (
          <div className={styles.errorPanel}>
            <p>
              <strong>That file isn&apos;t in the invited folder.</strong>
            </p>
            <p>
              The invite was for a file in{' '}
              <strong>{step.expectedName}</strong> but you picked{' '}
              <strong>{step.pickedName}</strong> from somewhere else.
            </p>
            <p className={styles.muted}>
              Try again — the picker should open into{' '}
              <strong>{step.expectedName}</strong>. Tap{' '}
              <strong>active.json</strong> without navigating away. If
              the folder isn&apos;t visible, ask whoever invited you to
              re-share it with this Google account.
            </p>
            <Button onClick={onAccept}>Try again</Button>
            <Button variant="secondary" onClick={handleGoHome}>
              Cancel
            </Button>
          </div>
        )}

        {fullyConfigured && step.kind === 'inspecting' && (
          <p className={styles.muted}>
            Checking <strong>{step.folderName}</strong>…
          </p>
        )}

        {fullyConfigured && step.kind === 'confirm-pull' && (
          <div className={styles.warning}>
            <p>
              <strong>
                ⚠ {step.folderName} already has Bean Counter data.
              </strong>
            </p>
            <p>
              Joining will <strong>replace your local data</strong> with
              what&apos;s in the shared folder. Your local litters,
              kittens, sessions, and weights will be lost.
            </p>
            <p className={styles.muted}>
              Shared folder contains {step.file.litters.length} litter
              {step.file.litters.length === 1 ? '' : 's'} and{' '}
              {step.file.kittens.length} kitten
              {step.file.kittens.length === 1 ? '' : 's'}.
            </p>
            <Button variant="danger" onClick={onConfirmPull}>
              Replace local with shared folder
            </Button>
            <Button variant="secondary" onClick={handleGoHome}>
              Cancel
            </Button>
          </div>
        )}

        {fullyConfigured && step.kind === 'success' && (
          <div>
            <p className={styles.success}>
              ✓ Joined <strong>{step.folderName}</strong>.
            </p>
            <p className={styles.muted}>
              You&apos;re now sharing data with the rest of your household.
              Edits sync on every navigation.
            </p>
            <Button onClick={handleGoHome}>Continue</Button>
          </div>
        )}

        {fullyConfigured && step.kind === 'error' && (
          <div className={styles.errorPanel}>
            <p className={styles.error}>{step.message}</p>
            <Button onClick={onAccept}>Try again</Button>
            <Button variant="secondary" onClick={handleGoHome}>
              Cancel
            </Button>
          </div>
        )}
      </main>
    </>
  )
}
