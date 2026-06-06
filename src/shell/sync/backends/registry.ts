import { useEffect, useState } from 'react'
import type { BackendKind, SyncBackend } from '../backend'
import { createOfflineBackend } from './offline'
import { createDriveBackend } from './drive'
import { createFirebaseBackend } from './firebase'

const PROVIDER_KEY = 'sync:provider'

// ── Cached instances ──────────────────────────────────────────────────────────

const instances: Partial<Record<BackendKind, SyncBackend>> = {}

function getInstance(kind: BackendKind): SyncBackend {
  if (instances[kind] === undefined) {
    switch (kind) {
      case 'offline':
        instances[kind] = createOfflineBackend()
        break
      case 'drive':
        instances[kind] = createDriveBackend()
        break
      case 'firebase':
        instances[kind] = createFirebaseBackend()
        break
    }
  }
  return instances[kind]!
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getStoredBackendKind(): BackendKind {
  return (localStorage.getItem(PROVIDER_KEY) as BackendKind) ?? 'offline'
}

export function getActiveBackend(): SyncBackend {
  return getInstance(getStoredBackendKind())
}

const listeners = new Set<() => void>()

export function setActiveBackend(kind: BackendKind): void {
  localStorage.setItem(PROVIDER_KEY, kind)
  for (const l of listeners) l()
}

// React hook: re-renders the caller whenever the active backend changes.
export function useActiveBackendKind(): BackendKind {
  const [kind, setKind] = useState<BackendKind>(getStoredBackendKind)
  useEffect(() => {
    const listener = () => {
      setKind(getStoredBackendKind())
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])
  return kind
}
