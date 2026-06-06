import { useEffect, useState } from 'react'

// Module-level singleton for errors that escape React's render lifecycle:
// event handlers, async functions, unhandled promise rejections, etc.
// These are NOT caught by react-router's errorElement (which only covers
// render-time errors). Populated by installGlobalErrorListeners().
//
// Modeled on shell/pwa/state.ts — same subscribe-on-mount pattern.

let currentError: unknown = null
const listeners = new Set<() => void>()

function notifyListeners(): void {
  for (const l of listeners) l()
}

export function getUnhandledError(): unknown {
  return currentError
}

export function setUnhandledError(err: unknown): void {
  currentError = err
  notifyListeners()
}

export function resetUnhandledError(): void {
  currentError = null
  notifyListeners()
}

export function useUnhandledError(): unknown {
  const [snapshot, setSnapshot] = useState<unknown>(currentError)
  useEffect(() => {
    const listener = () => setSnapshot(currentError)
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])
  return snapshot
}

let installed = false

export function installGlobalErrorListeners(): void {
  if (installed) return
  installed = true

  window.addEventListener('error', (event) => {
    // ResizeObserver loop warnings are benign browser noise — ignore them.
    if (typeof event.message === 'string' && event.message.includes('ResizeObserver')) return
    // "Script error." with no error object is a sanitised cross-origin error —
    // typically from Google's GSI or Picker scripts running in iframes on iOS
    // Firefox. There's no actionable stack trace, and treating it as a fatal
    // crash just confuses the user. Ignore it and let the auth/sync error
    // handlers surface a real message if the operation failed.
    if (event.message === 'Script error.' && event.error == null) return
    setUnhandledError(event.error ?? new Error(event.message))
  })

  window.addEventListener('unhandledrejection', (event) => {
    setUnhandledError(
      event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason)),
    )
  })
}
