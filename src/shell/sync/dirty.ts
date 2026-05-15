// Tracks "local has unpushed changes." Pure flag with no timer.
//
// Sync is triggered by explicit user moments (navigation, Finish-weights,
// boot, manual Sync now) — not by a background debounce. This module
// just answers "do we have unpushed changes?" so those triggers know
// whether to fire a sync, and bumps the indicator from Synced → Dirty
// the moment a local edit lands.

import { markStateDirtyIfSynced } from './state'

let dirtyTimestamp = 0
let suspended = false

export function markDirty(): void {
  if (suspended) return
  dirtyTimestamp = Date.now()
  markStateDirtyIfSynced()
}

export function clearDirty(): void {
  dirtyTimestamp = 0
}

export function isDirty(): boolean {
  return dirtyTimestamp > 0
}

export function getDirtySince(): number {
  return dirtyTimestamp
}

// Called by the orchestrator while it's applying remote state to local
// Dexie, so its own writes don't re-mark dirty in a loop.
export function setSuspended(s: boolean): void {
  suspended = s
}
