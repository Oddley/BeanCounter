import type { ActiveFileSnapshot } from '../../../core/active-file'
import type { InspectionResult, SyncBackend } from '../backend'

export function createOfflineBackend(): SyncBackend {
  return {
    kind: 'offline',
    displayName: '',
    isConfigured: () => false,
    async inspect(): Promise<InspectionResult> {
      return { kind: 'empty' }
    },
    async write(_snapshot: ActiveFileSnapshot, _token: string | null): Promise<string | null> {
      return null
    },
  }
}
