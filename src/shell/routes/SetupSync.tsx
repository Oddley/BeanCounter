import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppBar, Button } from '../components'
import {
  requestToken,
  pickFolder,
  setStoredFolder,
  clearStoredFolder,
} from '../auth'
import {
  setStoredFirebaseConfig,
  clearStoredFirebaseConfig,
  type FirebaseConfig,
} from '../auth/firebase'
import {
  setSyncState,
  runSync,
  inspectDrive,
  setActiveBackend,
} from '../sync'
import {
  isSidecarAvailable,
  adoptSidecarConnection,
} from '../sync/sidecar'
import {
  signInToFirebase,
  testFirestoreAccess,
  signOutFromFirebase,
} from '../sync/backends/firebase'
import styles from './SidecarSetup.module.css'

const APK_URL = 'https://github.com/Oddley/BeanCounter/releases/latest'

const FIRESTORE_RULES_TEMPLATE = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/state/active {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}`

type Step =
  // ── Provider selection ──────────────────────────────────────────────────────
  | { kind: 'choose-provider' }
  // ── Drive steps (from former SidecarSetup) ─────────────────────────────────
  | { kind: 'drive-choose' }
  | { kind: 'drive-android-download' }
  | { kind: 'drive-android-waiting' }
  | { kind: 'drive-android-syncing' }
  | { kind: 'drive-browser-connecting' }
  | { kind: 'drive-confirm-or-join'; folderName: string }
  // ── Firebase steps ──────────────────────────────────────────────────────────
  | { kind: 'firebase-paste-config' }
  | { kind: 'firebase-signing-in' }
  | { kind: 'firebase-check-rules'; config: FirebaseConfig; uid: string }
  | { kind: 'firebase-syncing' }
  // ── Shared ──────────────────────────────────────────────────────────────────
  | { kind: 'done' }
  | { kind: 'error'; message: string }

export function SetupSync() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>({ kind: 'choose-provider' })
  const [firebaseConfigText, setFirebaseConfigText] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Drive: sidecar polling ────────────────────────────────────────────────

  useEffect(() => {
    if (step.kind !== 'drive-android-waiting') {
      if (pollRef.current !== null) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [step.kind])

  useEffect(() => {
    if (step.kind !== 'drive-android-waiting') return
    pollRef.current = setInterval(() => {
      void (async () => {
        const available = await isSidecarAvailable()
        if (!available) return
        clearInterval(pollRef.current!)
        pollRef.current = null
        await handleSidecarDetected()
      })()
    }, 2000)
    return () => { if (pollRef.current !== null) clearInterval(pollRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.kind])

  // Auto-detect sidecar on mount (user might have already installed it).
  useEffect(() => {
    if (step.kind !== 'choose-provider') return
    void (async () => {
      const available = await isSidecarAvailable()
      if (available) await handleSidecarDetected()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Drive helpers ─────────────────────────────────────────────────────────

  async function handleSidecarDetected() {
    setStep({ kind: 'drive-android-syncing' })
    try {
      const adopted = await adoptSidecarConnection()
      if (!adopted) {
        await runDriveBrowserPickerFlow()
        return
      }
      setActiveBackend('drive')
      await firstSync()
    } catch (err) {
      setStep({ kind: 'error', message: err instanceof Error ? err.message : 'Sync failed' })
    }
  }

  async function runDriveBrowserPickerFlow() {
    setStep({ kind: 'drive-browser-connecting' })
    setSyncState({ status: 'syncing', errorMessage: '' })
    try {
      const token = await requestToken()
      const folder = await pickFolder(token.accessToken)
      if (folder === null) {
        setSyncState({ status: 'offline', errorMessage: '' })
        setStep({ kind: 'drive-choose' })
        return
      }
      setStoredFolder(folder.id, folder.name)

      const inspection = await inspectDrive(token.accessToken, folder.id)
      if (inspection.kind === 'empty') {
        setSyncState({ status: 'offline', errorMessage: '' })
        setStep({ kind: 'drive-confirm-or-join', folderName: folder.name })
        return
      }
      setActiveBackend('drive')
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

  // ── Firebase helpers ──────────────────────────────────────────────────────

  function parseFirebaseConfig(text: string): FirebaseConfig | null {
    try {
      // Accept either raw JSON or the SDK snippet (extract the object literal).
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) return null
      const obj = JSON.parse(match[0]) as Partial<FirebaseConfig>
      if (!obj.apiKey || !obj.authDomain || !obj.projectId || !obj.appId) return null
      return { apiKey: obj.apiKey, authDomain: obj.authDomain, projectId: obj.projectId, appId: obj.appId }
    } catch {
      return null
    }
  }

  async function handleFirebaseConnect() {
    const config = parseFirebaseConfig(firebaseConfigText)
    if (config === null) {
      setStep({ kind: 'error', message: 'Could not parse Firebase config. Make sure you pasted the full config object (apiKey, authDomain, projectId, appId are required).' })
      return
    }
    setStoredFirebaseConfig(config)
    setStep({ kind: 'firebase-signing-in' })
    try {
      const uid = await signInToFirebase(config)
      const access = await testFirestoreAccess(config, uid)
      if (access === 'permission-denied') {
        setStep({ kind: 'firebase-check-rules', config, uid })
        return
      }
      if (access === 'error') {
        throw new Error('Firestore access check failed — check your Firebase project settings.')
      }
      setActiveBackend('firebase')
      setStep({ kind: 'firebase-syncing' })
      await firstSync()
    } catch (err) {
      await signOutFromFirebase()
      clearStoredFirebaseConfig()
      const message = err instanceof Error ? err.message : 'Firebase setup failed'
      setStep({ kind: 'error', message })
    }
  }

  async function handleRetryRulesCheck(config: FirebaseConfig, uid: string) {
    const access = await testFirestoreAccess(config, uid)
    if (access === 'ok') {
      setActiveBackend('firebase')
      setStep({ kind: 'firebase-syncing' })
      await firstSync()
    } else if (access === 'permission-denied') {
      // Rules still not set — let user try again
      setStep({ kind: 'firebase-check-rules', config, uid })
    } else {
      setStep({ kind: 'error', message: 'Firestore access check failed.' })
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <AppBar title="Set up sync" backTo="/settings" />
      <main className={styles.main}>

        {/* ── Provider selection ─────────────────────────────────────────── */}
        {step.kind === 'choose-provider' && (
          <>
            <p className={styles.intro}>
              Choose how Bean Counter should sync your data across devices.
            </p>

            <div className={styles.option}>
              <div className={styles.optionLabel}>
                <strong>Google Drive</strong>
              </div>
              <p className={styles.optionDesc}>
                Sync to a folder in your Google Drive. Works on any device.
                Android users can install a background sync app for seamless
                always-on sync without popups.
              </p>
              <Button onClick={() => setStep({ kind: 'drive-choose' })}>
                Use Google Drive
              </Button>
            </div>

            <div className={styles.option}>
              <div className={styles.optionLabel}>
                <strong>Firebase</strong>
              </div>
              <p className={styles.optionDesc}>
                Sync to your own Firebase project (Firestore). Requires a
                Firebase account and a few minutes of one-time setup. Tokens
                refresh automatically — no manual sync needed on any platform.
              </p>
              <Button variant="secondary" onClick={() => setStep({ kind: 'firebase-paste-config' })}>
                Use Firebase
              </Button>
            </div>

            <div className={styles.option}>
              <div className={styles.optionLabel}>
                <strong>Offline only</strong>
              </div>
              <p className={styles.optionDesc}>
                No sync. Your data lives on this device only.
              </p>
              <Button
                variant="secondary"
                onClick={() => {
                  setActiveBackend('offline')
                  void navigate('/', { replace: true })
                }}
              >
                Stay offline
              </Button>
            </div>
          </>
        )}

        {/* ── Drive: choose Android or browser ──────────────────────────── */}
        {step.kind === 'drive-choose' && (
          <>
            <p className={styles.intro}>
              Bean Counter syncs your kitten weights across devices via Google Drive.
              Choose how you&apos;d like to connect:
            </p>

            <div className={styles.option}>
              <div className={styles.optionLabel}>
                <strong>Android sync app</strong>
                <span className={styles.badge}>Recommended</span>
              </div>
              <p className={styles.optionDesc}>
                Install a small background app on your Android phone. Holds your
                Google credentials permanently — no manual sync or popups, ever.
              </p>
              <Button onClick={() => setStep({ kind: 'drive-android-download' })}>
                Set up Android sync
              </Button>
            </div>

            <div className={styles.option}>
              <div className={styles.optionLabel}>
                <strong>Browser only</strong>
              </div>
              <p className={styles.optionDesc}>
                Connect directly from this browser. You&apos;ll need to tap
                &quot;Sync now&quot; occasionally when the session expires.
                Works on any device.
              </p>
              <Button variant="secondary" onClick={() => void runDriveBrowserPickerFlow()}>
                Connect via browser
              </Button>
            </div>

            <Button variant="secondary" onClick={() => setStep({ kind: 'choose-provider' })}>
              ← Back
            </Button>
          </>
        )}

        {/* ── Drive: Android download ────────────────────────────────────── */}
        {step.kind === 'drive-android-download' && (
          <>
            <p className={styles.stepNum}>Step 1 of 2</p>
            <h2 className={styles.stepTitle}>Install Bean Counter Sync</h2>
            <p className={styles.stepBody}>
              Download the Bean Counter Sync app and install it on this device.
            </p>
            <Button onClick={() => window.open(APK_URL, '_blank')}>
              Download the app
            </Button>
            <p className={styles.hint}>
              After installing and signing in with Google, come back here and tap Continue.
            </p>
            <Button variant="secondary" onClick={() => setStep({ kind: 'drive-android-waiting' })}>
              I&apos;ve installed and signed in →
            </Button>
          </>
        )}

        {/* ── Drive: waiting for sidecar ────────────────────────────────── */}
        {step.kind === 'drive-android-waiting' && (
          <>
            <p className={styles.stepNum}>Step 2 of 2</p>
            <h2 className={styles.stepTitle}>Waiting for sync app…</h2>
            <p className={styles.stepBody}>
              Looking for Bean Counter Sync on this device. Make sure the app is
              installed and you&apos;ve signed in with your Google account.
            </p>
            <div className={styles.spinner} aria-label="Waiting" />
            <Button variant="secondary" onClick={() => setStep({ kind: 'drive-android-download' })}>
              ← Back
            </Button>
          </>
        )}

        {/* ── Drive: connecting / syncing ────────────────────────────────── */}
        {(step.kind === 'drive-android-syncing' || step.kind === 'drive-browser-connecting') && (
          <>
            <h2 className={styles.stepTitle}>Connecting…</h2>
            <p className={styles.stepBody}>Setting up your Drive connection.</p>
            <div className={styles.spinner} aria-label="Connecting" />
          </>
        )}

        {/* ── Drive: confirm-or-join ─────────────────────────────────────── */}
        {step.kind === 'drive-confirm-or-join' && (
          <>
            <h2 className={styles.stepTitle}>No data found in this folder</h2>
            <p className={styles.stepBody}>
              <strong>{step.folderName}</strong> appears empty to Bean Counter.
              Are you starting a fresh sync here, or were you invited to join
              someone else&apos;s existing household?
            </p>
            <p className={styles.hint}>
              If you received an invite link, use that instead — it grants access
              to the existing data file rather than creating a new one.
            </p>
            <Button onClick={() => { setActiveBackend('drive'); void firstSync() }}>
              Start fresh here
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                clearStoredFolder()
                setSyncState({ status: 'offline', errorMessage: '' })
                setStep({ kind: 'drive-choose' })
              }}
            >
              I have an invite link — go back
            </Button>
          </>
        )}

        {/* ── Firebase: paste config ─────────────────────────────────────── */}
        {step.kind === 'firebase-paste-config' && (
          <>
            <h2 className={styles.stepTitle}>Your Firebase config</h2>
            <p className={styles.stepBody}>
              In Firebase Console → Project Settings → Your apps, copy the
              firebaseConfig object and paste it below.
            </p>
            <textarea
              rows={8}
              style={{
                width: '100%',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                background: '#111',
                color: '#e5e7eb',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-2)',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
              placeholder={`{\n  "apiKey": "...",\n  "authDomain": "...",\n  "projectId": "...",\n  "appId": "..."\n}`}
              value={firebaseConfigText}
              onChange={(e) => setFirebaseConfigText(e.target.value)}
            />
            <p className={styles.hint}>
              You&apos;ll also need to enable <strong>Firestore</strong> and{' '}
              <strong>Google Authentication</strong> in your Firebase project,
              and set Firestore security rules (shown after sign-in).
            </p>
            <Button
              onClick={() => void handleFirebaseConnect()}
              disabled={firebaseConfigText.trim() === ''}
            >
              Connect with Firebase
            </Button>
            <Button variant="secondary" onClick={() => setStep({ kind: 'choose-provider' })}>
              ← Back
            </Button>
          </>
        )}

        {/* ── Firebase: signing in ──────────────────────────────────────── */}
        {step.kind === 'firebase-signing-in' && (
          <>
            <h2 className={styles.stepTitle}>Signing in…</h2>
            <p className={styles.stepBody}>
              Completing Google sign-in and checking Firestore access.
            </p>
            <div className={styles.spinner} aria-label="Signing in" />
          </>
        )}

        {/* ── Firebase: rules check ─────────────────────────────────────── */}
        {step.kind === 'firebase-check-rules' && (
          <>
            <h2 className={styles.stepTitle}>Set Firestore security rules</h2>
            <p className={styles.stepBody}>
              Firestore returned a permission error. Copy the rules below into
              Firebase Console → Firestore → Rules, then tap Retry.
            </p>
            <textarea
              readOnly
              rows={10}
              style={{
                width: '100%',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                background: '#111',
                color: '#e5e7eb',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-2)',
                resize: 'none',
                boxSizing: 'border-box',
              }}
              value={FIRESTORE_RULES_TEMPLATE}
            />
            <Button
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(FIRESTORE_RULES_TEMPLATE).catch(() => undefined)
              }}
            >
              Copy rules
            </Button>
            <Button onClick={() => void handleRetryRulesCheck(step.config, step.uid)}>
              I&apos;ve set the rules — Retry
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                await signOutFromFirebase()
                clearStoredFirebaseConfig()
                setStep({ kind: 'firebase-paste-config' })
              }}
            >
              ← Back
            </Button>
          </>
        )}

        {/* ── Firebase: syncing ─────────────────────────────────────────── */}
        {step.kind === 'firebase-syncing' && (
          <>
            <h2 className={styles.stepTitle}>Syncing…</h2>
            <p className={styles.stepBody}>Connecting to Firebase.</p>
            <div className={styles.spinner} aria-label="Syncing" />
          </>
        )}

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {step.kind === 'error' && (
          <>
            <h2 className={styles.stepTitle}>Something went wrong</h2>
            <p className={styles.stepBody}>{step.message}</p>
            <Button onClick={() => setStep({ kind: 'choose-provider' })}>Try again</Button>
          </>
        )}
      </main>
    </>
  )
}
