import { useEffect, useState } from 'react'

// Five sync states, ordered by precedence (higher takes the indicator
// when multiple conditions could apply):
//
//   offline   — Drive not configured / not connected (terminal at rest)
//   syncing   — A sync run is in flight right now
//   error     — Last sync attempt failed; local has changes that didn't reach Drive
//   dirty     — Local has unpushed edits; no sync attempted yet since the last green
//   synced    — Local matches Drive
//
// The model intentionally surfaces "dirty but not yet attempted" as a
// distinct state from "tried and failed" — they require different user
// mental models even though both mean "your changes are local-only".
export type SyncStatus =
  | 'offline'
  | 'syncing'
  | 'error'
  | 'dirty'
  | 'synced'

export interface SyncState {
  readonly status: SyncStatus
  readonly errorMessage: string
  readonly lastSyncedAt: number
  readonly conflictCount: number
}

const INITIAL_STATE: SyncState = {
  status: 'offline',
  errorMessage: '',
  lastSyncedAt: 0,
  conflictCount: 0,
}

let currentState: SyncState = INITIAL_STATE
const listeners = new Set<() => void>()

export function getSyncState(): SyncState {
  return currentState
}

export function setSyncState(
  next: Partial<SyncState> & Pick<SyncState, 'status'>,
): void {
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

// Flip Synced → Dirty when a local edit happens. Called from markDirty.
// Does nothing if we're already in a more-urgent state (syncing, error)
// or in a state where "dirty" doesn't apply (offline).
export function markStateDirtyIfSynced(): void {
  if (currentState.status === 'synced') {
    setSyncState({ ...currentState, status: 'dirty' })
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
