import { useEffect, useState } from 'react'

// Module-level state mirroring the SW lifecycle. Surface for UI (Settings).
// Updated by shell/pwa/register.ts; read by usePwaStatus().

export interface PwaStatus {
  // When the SW first registered for this session. 0 = not yet registered.
  readonly registeredAt: number
  // When we last asked the SW to check for an update. 0 = never.
  readonly lastCheckedAt: number
  // True once vite-plugin-pwa has detected a newer SW that's downloaded
  // and ready to take over the page on next reload.
  readonly needsRefresh: boolean
  // True once the SW has cached enough to serve the app offline.
  readonly offlineReady: boolean
  // Error message from registration failure. Null if registration is OK.
  readonly registrationError: string | null
}

const INITIAL_STATE: PwaStatus = {
  registeredAt: 0,
  lastCheckedAt: 0,
  needsRefresh: false,
  offlineReady: false,
  registrationError: null,
}

let currentState: PwaStatus = INITIAL_STATE
const listeners = new Set<() => void>()

export function getPwaStatus(): PwaStatus {
  return currentState
}

export function setPwaStatus(next: Partial<PwaStatus>): void {
  currentState = { ...currentState, ...next }
  for (const listener of listeners) {
    listener()
  }
}

export function usePwaStatus(): PwaStatus {
  const [snapshot, setSnapshot] = useState<PwaStatus>(currentState)
  useEffect(() => {
    const listener = () => {
      setSnapshot(currentState)
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])
  return snapshot
}
