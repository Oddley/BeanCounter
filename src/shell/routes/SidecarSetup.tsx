import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppBar, Button } from '../components'
import {
  requestToken,
  pickFolder,
  setStoredFolder,
} from '../auth'
import { setSyncState, runSync } from '../sync'
import {
  isSidecarAvailable,
  adoptSidecarConnection,
} from '../sync/sidecar'
import styles from './SidecarSetup.module.css'

// GITHUB_RELEASES_URL is replaced at build time via Vite define.
// Falls back to the repo releases page if not configured.
const APK_URL = 'https://github.com/Oddley/BeanCounter/releases/latest'

type Step =
  | { kind: 'choose' }
  | { kind: 'android-download' }
  | { kind: 'android-waiting' }
  | { kind: 'android-syncing' }
  | { kind: 'browser-connecting' }
  | { kind: 'done' }
  | { kind: 'error'; message: string }

/**
 * First-connect wizard for new users.
 *
 * Reachable from Settings when no Drive connection is stored.
 * Offers two paths:
 *   A. Android sidecar — guides through downloading and signing in to the
 *      Bean Counter Sync app, then polls localhost:7734 until it appears.
 *   B. Browser only — runs the existing OAuth + Picker flow (desktop / no Android).
 *
 * After either path succeeds, fires a first sync and navigates to "/".
 */
export function SidecarSetup() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(() =>
    // Fast-track to waiting if sidecar is already running (user installed it
    // before opening the PWA, or returned here after installing it).
    ({ kind: 'choose' }),
  )
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Stop polling when the component unmounts or the step changes away from waiting.
  useEffect(() => {
    if (step.kind !== 'android-waiting') {
      if (pollRef.current !== null) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [step.kind])

  // Start polling once we reach the 'waiting' step.
  useEffect(() => {
    if (step.kind !== 'android-waiting') return
    pollRef.current = setInterval(async () => {
      const available = await isSidecarAvailable()
      if (!available) return
      clearInterval(pollRef.current!)
      pollRef.current = null
      await handleSidecarDetected()
    }, 2000)
    return () => {
      if (pollRef.current !== null) clearInterval(pollRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.kind])

  // Also check immediately on mount in case the sidecar is already running.
  useEffect(() => {
    void (async () => {
      const available = await isSidecarAvailable()
      if (available) {
        // Sidecar already up — skip straight to adopting the connection.
        await handleSidecarDetected()
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSidecarDetected() {
    setStep({ kind: 'android-syncing' })
    try {
      const adopted = await adoptSidecarConnection()
      if (!adopted) {
        // Sidecar is running but has no folder stored yet — still need Picker.
        await runBrowserPickerFlow()
        return
      }
      await firstSync()
    } catch (err) {
      setStep({ kind: 'error', message: err instanceof Error ? err.message : 'Sync failed' })
    }
  }

  async function runBrowserPickerFlow() {
    setStep({ kind: 'browser-connecting' })
    setSyncState({ status: 'syncing', errorMessage: '' })
    try {
      const token = await requestToken()
      const folder = await pickFolder(token.accessToken)
      if (folder === null) {
        setSyncState({ status: 'offline', errorMessage: '' })
        setStep({ kind: 'choose' })
        return
      }
      setStoredFolder(folder.id, folder.name)
      await firstSync()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed'
      setSyncState({ status: 'error', errorMessage: message })
      setStep({ kind: 'error', message })
    }
  }

  async function firstSync() {
    const result = await runSync()
    if (result.kind === 'needs-auth') {
      setSyncState({ status: 'offline', errorMessage: '' })
      setStep({ kind: 'error', message: 'Drive auth failed — try again' })
      return
    }
    if (result.kind === 'error') {
      setStep({ kind: 'error', message: result.message })
      return
    }
    setStep({ kind: 'done' })
    void navigate('/', { replace: true })
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <AppBar title="Connect to Drive" />
      <main className={styles.main}>
        {step.kind === 'choose' && (
          <>
            <p className={styles.intro}>
              Bean Counter syncs your kitten weights across devices via Google Drive. Choose how
              you&apos;d like to set it up:
            </p>

            <div className={styles.option}>
              <div className={styles.optionLabel}>
                <strong>Android sync app</strong>
                <span className={styles.badge}>Recommended</span>
              </div>
              <p className={styles.optionDesc}>
                Install a small background app on your Android phone. It holds your Google
                credentials permanently — no more manual sync or popups, ever.
              </p>
              <Button onClick={() => setStep({ kind: 'android-download' })}>
                Set up Android sync
              </Button>
            </div>

            <div className={styles.option}>
              <div className={styles.optionLabel}>
                <strong>Browser only</strong>
              </div>
              <p className={styles.optionDesc}>
                Connect directly from this browser. You&apos;ll need to tap &quot;Sync now&quot;
                occasionally when the session expires. Works on any device.
              </p>
              <Button variant="secondary" onClick={() => void runBrowserPickerFlow()}>
                Connect via browser
              </Button>
            </div>
          </>
        )}

        {step.kind === 'android-download' && (
          <>
            <p className={styles.stepNum}>Step 1 of 2</p>
            <h2 className={styles.stepTitle}>Install Bean Counter Sync</h2>
            <p className={styles.stepBody}>
              Download the Bean Counter Sync app and install it on this device. You may need to
              allow installation from unknown sources in your browser&apos;s download settings.
            </p>
            <Button
              onClick={() => window.open(APK_URL, '_blank')}
            >
              Download the app
            </Button>
            <p className={styles.hint}>
              After installing and signing in with Google, come back here and tap Continue.
            </p>
            <Button
              variant="secondary"
              onClick={() => setStep({ kind: 'android-waiting' })}
            >
              I&apos;ve installed and signed in →
            </Button>
          </>
        )}

        {step.kind === 'android-waiting' && (
          <>
            <p className={styles.stepNum}>Step 2 of 2</p>
            <h2 className={styles.stepTitle}>Waiting for sync app…</h2>
            <p className={styles.stepBody}>
              Looking for Bean Counter Sync on this device. Make sure the app is installed and
              you&apos;ve signed in with your Google account.
            </p>
            <div className={styles.spinner} aria-label="Waiting" />
            <Button variant="secondary" onClick={() => setStep({ kind: 'android-download' })}>
              ← Back
            </Button>
          </>
        )}

        {(step.kind === 'android-syncing' || step.kind === 'browser-connecting') && (
          <>
            <h2 className={styles.stepTitle}>Connecting…</h2>
            <p className={styles.stepBody}>Setting up your Drive connection.</p>
            <div className={styles.spinner} aria-label="Connecting" />
          </>
        )}

        {step.kind === 'error' && (
          <>
            <h2 className={styles.stepTitle}>Something went wrong</h2>
            <p className={styles.stepBody}>{step.message}</p>
            <Button onClick={() => setStep({ kind: 'choose' })}>Try again</Button>
          </>
        )}
      </main>
    </>
  )
}
