import { Link } from 'react-router-dom'
import { AppBar } from '../components'
import { Button } from '../components'
import { ActiveProviderPanel } from '../components/ActiveProviderPanel'
import { usePwaStatus, applyPendingUpdate } from '../pwa'
import styles from './Settings.module.css'

export function Settings() {
  const pwaStatus = usePwaStatus()

  return (
    <>
      <AppBar title="Settings" backTo="/" />
      <main className={styles.main}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Sync</h2>
          <ActiveProviderPanel />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>App version</h2>
          {pwaStatus.registrationError !== null && (
            <p className={styles.error}>
              Couldn&apos;t check for updates: {pwaStatus.registrationError}
            </p>
          )}
          {pwaStatus.registrationError === null && pwaStatus.needsRefresh && (
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
                ✓ Up to date — last checked {formatRelative(pwaStatus.lastCheckedAt)}.
              </p>
            )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Feedback</h2>
          <p className={styles.muted}>
            Hit a bug or have an idea? Filing an issue on GitHub helps us keep track and respond.
          </p>
          <div className={styles.feedbackButtons}>
            <Button
              variant="secondary"
              onClick={() => {
                const info = `App version: ${__APP_VERSION__}\nUser-agent: ${navigator.userAgent}`
                const url =
                  'https://github.com/Oddley/BeanCounter/issues/new' +
                  '?template=bug_report.yml' +
                  `&diagnostic_info=${encodeURIComponent(info)}`
                window.open(url, '_blank', 'noopener,noreferrer')
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
