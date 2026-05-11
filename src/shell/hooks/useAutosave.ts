import { useEffect, useRef } from 'react'

export interface UseAutosaveOptions<T> {
  readonly value: T
  readonly delayMs: number
  readonly onSave: (value: T) => void | Promise<void>
  readonly enabled?: boolean
}

export function useAutosave<T>({
  value,
  delayMs,
  onSave,
  enabled = true,
}: UseAutosaveOptions<T>): void {
  const latestValue = useRef(value)
  const latestSave = useRef(onSave)
  latestValue.current = value
  latestSave.current = onSave

  const firstRun = useRef(true)

  useEffect(() => {
    if (!enabled) return
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    const handle = setTimeout(() => {
      void latestSave.current(latestValue.current)
    }, delayMs)
    return () => {
      clearTimeout(handle)
    }
  }, [value, delayMs, enabled])
}
