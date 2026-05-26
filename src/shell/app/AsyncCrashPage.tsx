import { useNavigate } from 'react-router-dom'
import { AppBar, Button } from '../components'
import { resetUnhandledError } from './globalErrorState'
// Reuse the same CSS as the render-time ErrorBoundary — identical visual.
import styles from '../routes/ErrorBoundary.module.css'

// Crash UI for errors that escape React's render lifecycle (event handlers,
// async functions, unhandled promise rejections). Rendered imperatively by
// SyncOnNavLayout when globalErrorState has a pending error.
//
// The render-time counterpart is src/shell/routes/ErrorBoundary.tsx, which
// uses useRouteError() and is mounted as the router's errorElement.

function describeError(err: unknown): { message: string; stack: string } {
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
    title: `[Crash] ${message.slice(0, 80)}`,
    'what-happened': `The app crashed with this error:\n\n${message.slice(0, 400)}`,
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

interface AsyncCrashPageProps {
  readonly error: unknown
}

export function AsyncCrashPage({ error }: AsyncCrashPageProps) {
  const navigate = useNavigate()
  const { message, stack } = describeError(error)

  const onReport = () => {
    window.open(buildCrashReportUrl(error), '_blank', 'noopener,noreferrer')
  }

  const onGoHome = () => {
    resetUnhandledError()
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
          pre-filled. You can add anything you remember about what you were
          doing when this happened.
        </p>
      </main>
    </>
  )
}
