import type { ActiveFileSnapshot } from '../../../core/active-file'
import { snapshotToJson } from '../../../core/active-file'
import {
  getValidToken,
  requestToken,
  hasStoredConnection,
  getStoredFolderId,
  getStoredFolderName,
  getStoredFileId,
  setStoredFileId,
} from '../../auth'
import { DriveError, writeFile } from '../../drive'
import { inspectDrive } from '../first-connect'
import {
  isSidecarAvailable,
  getSidecarPreferred,
  pushConnectionToSidecar,
  sidecarInspect,
  sidecarWrite,
  tryWakeSidecar,
} from '../sidecar'
import type { InspectionResult, SyncBackend } from '../backend'
import { NeedsAuthError } from '../backend'

const ACTIVE_FILE_NAME = 'active.json'

// State threaded from inspect() to write() within a single sync run.
interface WriteCtx {
  folderId: string
  fileId: string | undefined
  useSidecar: boolean
  token: string | null
}

export function createDriveBackend(): SyncBackend {
  let writeCtx: WriteCtx | null = null

  return {
    kind: 'drive',
    displayName: 'Drive',
    isConfigured: () => hasStoredConnection(),

    async inspect(options): Promise<InspectionResult> {
      const folderId = getStoredFolderId()
      if (folderId === null) return { kind: 'empty' }

      // Sidecar wake + retry — only attempted when this run was fired from a
      // direct user gesture (options.allowInteractive). Silent boot/nav syncs
      // have no gesture to spend, so a beancounter-sync:// launch there would
      // always trigger Chrome's "Open in app?" confirmation; they instead just
      // use the sidecar if it happens to already be running (ping below) and
      // fall through to the token-based path otherwise. The wake itself is
      // fired synchronously by the caller (see sidecar.ts wakeSidecarIfNeeded)
      // so the gesture is still fresh; tryWakeSidecar() here is a harmless,
      // idempotent backstop in case that didn't happen.
      let useSidecar = await isSidecarAvailable()
      if (!useSidecar && getSidecarPreferred() && options?.allowInteractive === true) {
        tryWakeSidecar()
        for (let i = 0; i < 3; i++) {
          await new Promise<void>((r) => setTimeout(r, 1500))
          useSidecar = await isSidecarAvailable()
          if (useSidecar) break
        }
        if (!useSidecar) {
          throw new Error('Open the BeanCounter Sync app to continue syncing')
        }
      }

      // Keep sidecar informed of current folder/file so it can resolve paths.
      if (useSidecar) {
        await pushConnectionToSidecar()
      }

      // Acquire Drive token (skipped when sidecar is handling auth).
      let token: string | null = null
      if (!useSidecar) {
        token = await getValidToken()
        if (token === null && options?.allowInteractive === true) {
          try {
            const fresh = await requestToken()
            token = fresh.accessToken
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Re-auth failed'
            throw new NeedsAuthError(`Sign-in cancelled or blocked: ${msg}`)
          }
        }
        if (token === null) {
          throw new NeedsAuthError(
            'Drive session expired — open Settings and tap "Sync now" to refresh',
          )
        }
      }

      const knownFileId = getStoredFileId() ?? undefined
      const raw = useSidecar
        ? await sidecarInspect(folderId, knownFileId)
        : await inspectDrive(token!, folderId, knownFileId)

      // Store Drive-specific context for the subsequent write() call.
      writeCtx = {
        folderId,
        fileId: raw.kind === 'exists' ? raw.fileId : undefined,
        useSidecar,
        token,
      }

      if (raw.kind === 'empty') return { kind: 'empty' }
      if (raw.kind === 'unreadable') return { kind: 'unreadable', error: raw.error }
      return { kind: 'exists', file: raw.file, concurrencyToken: raw.concurrencyToken }
    },

    async write(snapshot: ActiveFileSnapshot, concurrencyToken: string | null): Promise<string | null> {
      const ctx = writeCtx
      if (ctx === null) throw new Error('DriveBackend: write() called before inspect()')

      const json = snapshotToJson(snapshot)
      let fileId: string

      if (ctx.useSidecar) {
        fileId = await sidecarWrite({
          folderId: ctx.folderId,
          content: json,
          ...(ctx.fileId !== undefined ? { existingFileId: ctx.fileId } : {}),
          fileName: ACTIVE_FILE_NAME,
          ...(concurrencyToken !== null && ctx.fileId !== undefined
            ? { ifMatch: concurrencyToken }
            : {}),
        })
      } else {
        fileId = await writeFile(ctx.token!, {
          name: ACTIVE_FILE_NAME,
          parentId: ctx.folderId,
          content: json,
          ...(ctx.fileId !== undefined ? { existingFileId: ctx.fileId } : {}),
          ...(concurrencyToken !== null && ctx.fileId !== undefined
            ? { ifMatch: concurrencyToken }
            : {}),
        })
      }

      // Cache the file id for the next sync's fast direct-fetch path.
      setStoredFileId(fileId)
      return null
    },
  }
}

// Re-export helpers consumed by Drive-specific UI code (Invite, SetupSync).
export { getStoredFolderName, getStoredFolderId }
export { DriveError }
