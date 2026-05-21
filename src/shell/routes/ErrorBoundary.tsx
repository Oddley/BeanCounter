import { useRouteError, useNavigate } from 'react-router-dom'
import { AppBar, Button } from '../components'
import styles from './ErrorBoundary.module.css'

// Mounted as `errorElement` on the root layout route. Catches any
// error thrown during render of a child route — React's default
// crash-page is replaced with this friendlier UI plus a one-tap
// "Report this bug" affordance that pre-fills our bug-report
// template with the crash details.
//
// Limitations worth knowing: react-router's errorElement does NOT
// catch errors thrown from event handlers, async functions, or
// setTimeout callbacks — those still bubble to window.onerror and
// the browser console. Future enhancement: hook window.onerror to
// route to this same surface (closes issue #17's spec more fully).

interface CrashFields {
  readonly message: string
  readonly stack: string
}

function describeError(err: unknown): CrashFields {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack ?? '(no stack)' }
  }
  return { message: String(err), stack: '(no stack)' }
}

function buildCrashReportUrl(err: unknown): string {
  const { message, stack } = describeError(err)
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
  const here = typeof window !== 'undefined' ? window.location.href : 'unknown'
  const params = new URLSearchParams({
    template: 'bug_report.yml',
    // GitHub trims long titles; keep this short and meaningful.
    title: `[Crash] ${message.slice(0, 80)}`,
    'what-happened': `The app crashed with this error:\n\n${message.slice(
      0,
      400,
    )}`,
    device: ua.slice(0, 200),
    extras: [
      `URL: ${here}`,
      `Time: ${new Date().toISOString()}`,
      '',
      'Stack trace:',
      stack.slice(0, 3500),
    ].join('\n'),
  })
  return `https://github.com/Oddley/BeanCounter/issues/new?${params.toString()}`
}

export function ErrorBoundary() {
  const err = useRouteError()
  const navigate = useNavigate()
  const { message, stack } = describeError(err)

  const onReport = () => {
    const url = buildCrashReportUrl(err)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const onGoHome = () => {
    void navigate('/', { replace: true })
  }

  return (
    <>
      <AppBar title="Something went wrong" />
      <main className={styles.main}>
        <p className={styles.intro}>
          Bean Counter ran into an unexpected error. Your data is safe — it
          stays in your phone and Drive.
        </p>

        <div className={styles.errorBox}>
          <pre className={styles.message}>{message}</pre>
        </div>

        <details className={styles.details}>
          <summary>Technical details</summary>
          <pre className={styles.stack}>{stack}</pre>
        </details>

        <div className={styles.buttons}>
          <Button onClick={onReport}>Report this bug</Button>
          <Button variant="secondary" onClick={onGoHome}>
            Go home
          </Button>
        </div>

        <p className={styles.muted}>
          The bug report will open in a new tab with the error details
          pre-filled. You can add anything you remember about what you
          were doing when this happened.
        </p>
      </main>
    </>
  )
}
