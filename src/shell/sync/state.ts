import { useEffect, useState } from 'react'

export type SyncStatus = 'unconnected' | 'pending' | 'synced' | 'error'

export interface SyncState {
  readonly status: SyncStatus
  readonly errorMessage: string
}

const INITIAL_STATE: SyncState = {
  status: 'unconnected',
  errorMessage: '',
}

let currentState: SyncState = INITIAL_STATE
const listeners = new Set<() => void>()

export function getSyncState(): SyncState {
  return currentState
}

export function setSyncState(next: SyncState): void {
  currentState = next
  for (const listener of listeners) {
    listener()
  }
}

export function useSyncState(): SyncState {
  const [snapshot, setSnapshot] = useState<SyncState>(currentState)
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
