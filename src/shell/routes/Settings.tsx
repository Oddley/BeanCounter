import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppBar, Button } from '../components'
import {
  isAuthConfigured,
  requestToken,
  hasToken,
} from '../auth'
import { listFiles, DriveError } from '../drive'
import { setSyncState, useSyncState } from '../sync'
import styles from './Settings.module.css'

interface ConnectionProbeResult {
  readonly kind: 'idle' | 'probing' | 'ok' | 'error'
  readonly visibleFiles: number
  readonly message: string
}

const INITIAL_PROBE: ConnectionProbeResult = {
  kind: 'idle',
  visibleFiles: 0,
  message: '',
}

export function Settings() {
  const syncState = useSyncState()
  const [probe, setProbe] = useState<ConnectionProbeResult>(INITIAL_PROBE)

  const configured = isAuthConfigured()
  const connected = hasToken()

  const handleConnect = async () => {
    setSyncState({ status: 'pending', errorMessage: '' })
    setProbe({ kind: 'probing', visibleFiles: 0, message: '' })
    try {
      const token = await requestToken()
      const files = await listFiles(token.accessToken, 'trashed = false')
      setSyncState({ status: 'synced', errorMessage: '' })
      setProbe({
        kind: 'ok',
        visibleFiles: files.length,
        message: '',
      })
    } catch (err) {
      const message =
        err instanceof DriveError
          ? `Drive API error (${String(err.status)}): ${err.message}`
          : err instanceof Error
            ? err.message
            : 'Unknown error'
      setSyncState({ status: 'error', errorMessage: message })
      setProbe({ kind: 'error', visibleFiles: 0, message })
    }
  }

  return (
    <>
      <AppBar title="Settings" backTo="/" />
      <main className={styles.main}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Google Drive Sync</h2>

          {!configured && (
            <div className={styles.notConfigured}>
              <p>
                <strong>Drive sync is not configured on this build.</strong>
              </p>
              <p className={styles.muted}>
                The <code>VITE_GOOGLE_CLIENT_ID</code> environment variable
                is empty. See <code>docs/SETUP-DRIVE.md</code> for the
                Google Cloud Console steps.
              </p>
            </div>
          )}

          {configured && (
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

              <Button
                onClick={handleConnect}
                disabled={probe.kind === 'probing'}
                className={styles.connectButton}
              >
                {probe.kind === 'probing'
                  ? 'Connecting…'
                  : connected
                    ? 'Re-authenticate'
                    : 'Connect to Google Drive'}
              </Button>

              {probe.kind === 'ok' && (
                <p className={styles.muted}>
                  Connection verified. Drive shows{' '}
                  <strong>{probe.visibleFiles}</strong> file
                  {probe.visibleFiles === 1 ? '' : 's'} visible to Bean
                  Counter. (First-time connect will be empty; subsequent
                  connects show files we've previously written.)
                </p>
              )}
              {probe.kind === 'error' && (
                <p className={styles.error}>{probe.message}</p>
              )}
            </>
          )}
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

function labelFor(status: 'unconnected' | 'pending' | 'synced' | 'error'): string {
  switch (status) {
    case 'unconnected':
      return 'Not connected'
    case 'pending':
      return 'Pending'
    case 'synced':
      return 'Connected'
    case 'error':
      return 'Error'
  }
}
