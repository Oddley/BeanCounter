import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppBar, Button } from '../components'
import {
  isAuthConfigured,
  isPickerConfigured,
  requestToken,
  pickFolder,
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
// open the Picker pre-tabbed to "Shared with me" so he can confirm the
// folder selection. After that, the existing inspectAndBranch path
// (also used by fresh connect) handles push / silent-pull /
// warn-then-pull.
//
// drive.file scope requires the user to explicitly select the file via
// Picker before the app gets access — we can't shortcut that even when
// we know the folder ID. The Picker IS the consent gesture.

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

      const picked = await pickFolder(token.accessToken, {
        preferSharedView: true,
      })
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

      // Sanity check: did they pick the folder Mama actually invited?
      if (picked.id !== expectedFolderId) {
        setStep({
          kind: 'mismatch',
          expectedName: expectedFolderName,
          pickedName: picked.name,
        })
        setSyncState({ status: 'offline', errorMessage: '' })
        return
      }

      // Match — proceed with the existing inspect-and-branch flow.
      setStoredFolder(picked.id, picked.name)
      setStep({ kind: 'inspecting', folderName: picked.name })
      const inspection = await inspectDrive(token.accessToken, picked.id)
      if (inspection.kind === 'empty') {
        // Shared folder is somehow empty — Mama hasn't pushed yet, or
        // the link is wrong. Treat as success-but-no-data; the user's
        // own next edit will populate.
        setSyncState({
          status: 'synced',
          errorMessage: '',
          lastSyncedAt: Date.now(),
        })
        setStep({ kind: 'success', folderName: picked.name })
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
          folderName: picked.name,
        })
      } else {
        await pullActiveToLocal(inspection.file)
        setSyncState({
          status: 'synced',
          errorMessage: '',
          lastSyncedAt: Date.now(),
        })
        setStep({ kind: 'success', folderName: picked.name })
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
    navigate('/')
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
              When you tap Accept, you&apos;ll sign in to Google, then pick
              the shared folder from a list. Look for it under{' '}
              <strong>&quot;Shared with me&quot;</strong>.
            </p>
            <Button onClick={handleAccept} className={styles.acceptButton}>
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
            Pick the shared folder from the &quot;Shared with me&quot; tab…
          </p>
        )}

        {fullyConfigured && step.kind === 'mismatch' && (
          <div className={styles.errorPanel}>
            <p>
              <strong>That doesn&apos;t look like the invited folder.</strong>
            </p>
            <p>
              The invite was for <strong>{step.expectedName}</strong> but you
              picked <strong>{step.pickedName}</strong>.
            </p>
            <p className={styles.muted}>
              Try again and look for <strong>{step.expectedName}</strong>{' '}
              under &quot;Shared with me&quot;. If you can&apos;t find it,
              ask whoever invited you to re-share the folder with this Google
              account.
            </p>
            <Button onClick={handleAccept}>Try again</Button>
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
            <Button variant="danger" onClick={handleConfirmPull}>
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
            <Button onClick={handleAccept}>Try again</Button>
            <Button variant="secondary" onClick={handleGoHome}>
              Cancel
            </Button>
          </div>
        )}
      </main>
    </>
  )
}
