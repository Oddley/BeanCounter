import { useCallback, useEffect, useRef } from 'react'

export interface UseAutosaveOptions<T> {
  readonly value: T
  readonly delayMs: number
  readonly onSave: (value: T) => void | Promise<void>
  readonly enabled?: boolean
}

export interface UseAutosaveResult {
  // Force an immediate save of the latest value if one is pending (i.e.,
  // the debounce timer hasn't fired yet). Wire to onBlur, before-unload,
  // or any other "user is leaving" moment to avoid losing edits.
  readonly flush: () => void
}

export function useAutosave<T>({
  value,
  delayMs,
  onSave,
  enabled = true,
}: UseAutosaveOptions<T>): UseAutosaveResult {
  const latestValue = useRef(value)
  const latestSave = useRef(onSave)
  const enabledRef = useRef(enabled)
  latestValue.current = value
  latestSave.current = onSave
  enabledRef.current = enabled

  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstRun = useRef(true)

  useEffect(() => {
    if (!enabled) return
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    pendingTimer.current = setTimeout(() => {
      pendingTimer.current = null
      void latestSave.current(latestValue.current)
    }, delayMs)
    return () => {
      if (pendingTimer.current !== null) {
        clearTimeout(pendingTimer.current)
        pendingTimer.current = null
      }
    }
  }, [value, delayMs, enabled])

  // Fire any pending save on unmount so navigating away mid-debounce
  // doesn't lose the most recent edit.
  useEffect(() => {
    return () => {
      if (pendingTimer.current !== null && enabledRef.current) {
        clearTimeout(pendingTimer.current)
        pendingTimer.current = null
        void latestSave.current(latestValue.current)
      }
    }
  }, [])

  const flush = useCallback(() => {
    if (pendingTimer.current !== null && enabledRef.current) {
      clearTimeout(pendingTimer.current)
      pendingTimer.current = null
      void latestSave.current(latestValue.current)
    }
  }, [])

  return { flush }
}
