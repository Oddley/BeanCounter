import { useEffect, useState } from 'react'

export type SyncStatus = 'unconnected' | 'pending' | 'synced' | 'error'

export interface SyncState {
  readonly status: SyncStatus
  readonly errorMessage: string
  readonly lastSyncedAt: number
  readonly conflictCount: number
}

const INITIAL_STATE: SyncState = {
  status: 'unconnected',
  errorMessage: '',
  lastSyncedAt: 0,
  conflictCount: 0,
}

let currentState: SyncState = INITIAL_STATE
const listeners = new Set<() => void>()

export function getSyncState(): SyncState {
  return currentState
}

export function setSyncState(next: Partial<SyncState> & Pick<SyncState, 'status'>): void {
  currentState = {
    status: next.status,
    errorMessage: next.errorMessage ?? '',
    lastSyncedAt: next.lastSyncedAt ?? currentState.lastSyncedAt,
    conflictCount: next.conflictCount ?? 0,
  }
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
