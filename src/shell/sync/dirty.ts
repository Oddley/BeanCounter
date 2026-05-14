// Tracks "local has unpushed changes" with a debounced auto-flush. The
// orchestrator wires in the actual sync runner via `setOnDebounce` so
// this module stays free of orchestrator imports (no circular deps).

const DEBOUNCE_MS = 60_000

let dirtyTimestamp = 0
let timer: ReturnType<typeof setTimeout> | null = null
let suspended = false
let onDebounceCallback: () => void = () => {}

export function markDirty(): void {
  if (suspended) return
  dirtyTimestamp = Date.now()
  if (timer !== null) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    onDebounceCallback()
  }, DEBOUNCE_MS)
}

export function clearDirty(): void {
  dirtyTimestamp = 0
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
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

// Called by the orchestrator at module init to register the runner that
// fires after the debounce window elapses.
export function setOnDebounce(cb: () => void): void {
  onDebounceCallback = cb
}
