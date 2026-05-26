import {
  listFiles,
  readFileContent,
  writeFile,
  escapeDriveQueryString,
} from '../drive'
import {
  parseActiveFile,
  snapshotToJson,
  type ActiveFile,
  type ActiveFileSnapshot,
} from '../../core/active-file'
import { NullAppSettings } from '../../core/settings'
import { db, SETTINGS_SINGLETON_ID, wipeAllData } from '../db'

const ACTIVE_FILE_NAME = 'active.json'

export interface InspectionEmpty {
  readonly kind: 'empty'
  readonly folderId: string
}

export interface InspectionExists {
  readonly kind: 'exists'
  readonly folderId: string
  readonly fileId: string
  readonly file: ActiveFile
  // ETag captured from the Drive response header. Forwarded to pushSnapshot
  // as If-Match so a concurrent write from another device yields 412 instead
  // of silent data loss. null if Drive omitted the header.
  readonly etag: string | null
}

export interface InspectionUnreadable {
  readonly kind: 'unreadable'
  readonly folderId: string
  readonly fileId: string
  readonly error: string
}

export type InspectionResult =
  | InspectionEmpty
  | InspectionExists
  | InspectionUnreadable

export async function inspectDrive(
  token: string,
  folderId: string,
  knownFileId?: string,
): Promise<InspectionResult> {
  // Fast path: if we already know the file id (recipient picked it via
  // Picker in the invite-accept flow, or we captured it after fresh-
  // connect's initial push), read it directly. Avoids the folder-search
  // query which requires drive.file scope on the FOLDER — recipients
  // post-invite have scope on the FILE only, so folder searches return
  // empty even when the file is right there in their scope.
  //
  // Surface direct-fetch errors as 'unreadable' rather than silently
  // falling through to the folder search — for recipients, the folder
  // search ALSO fails and surfaces a misleading 'empty' result.
  if (knownFileId !== undefined) {
    try {
      const { content, etag } = await readFileContent(token, knownFileId)
      const parsed = parseActiveFile(content)
      if (!parsed.ok) {
        return {
          kind: 'unreadable',
          folderId,
          fileId: knownFileId,
          error: parsed.error,
        }
      }
      return {
        kind: 'exists',
        folderId,
        fileId: knownFileId,
        file: parsed.file,
        etag,
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown fetch error'
      return {
        kind: 'unreadable',
        folderId,
        fileId: knownFileId,
        error: `Direct fetch of file ${knownFileId} failed: ${message}`,
      }
    }
  }
  const escapedName = escapeDriveQueryString(ACTIVE_FILE_NAME)
  const matches = await listFiles(
    token,
    `'${folderId}' in parents and name = '${escapedName}' and trashed = false`,
  )
  const first = matches[0]
  if (first === undefined) {
    return { kind: 'empty', folderId }
  }
  const { content, etag } = await readFileContent(token, first.id)
  const parsed = parseActiveFile(content)
  if (!parsed.ok) {
    return {
      kind: 'unreadable',
      folderId,
      fileId: first.id,
      error: parsed.error,
    }
  }
  return {
    kind: 'exists',
    folderId,
    fileId: first.id,
    file: parsed.file,
    etag,
  }
}

export async function snapshotLocal(): Promise<ActiveFileSnapshot> {
  const [litters, kittens, sessions, weightEntries, settings] =
    await Promise.all([
      db.litters.toArray(),
      db.kittens.toArray(),
      db.feedingSessions.toArray(),
      db.weightEntries.toArray(),
      db.settings.get(SETTINGS_SINGLETON_ID),
    ])
  // Drive only sees completed feedings. Partial (completed=false)
  // sessions are work-in-progress, local-only state — they live in
  // Dexie until the user taps Submit, at which point completeSession
  // flips completed=true and the next sync picks them up.
  //
  // Soft-deleted-but-completed sessions DO sync (tombstones propagate
  // the deletion to peers). Sessions that were soft-deleted while
  // still incomplete (rare/impossible in current UX) are skipped —
  // they were never on Drive, so no tombstone is owed.
  const syncableSessions = sessions.filter((s) => s.completed)
  const syncableSessionIds = new Set(syncableSessions.map((s) => s.id))
  const syncableEntries = weightEntries.filter((e) =>
    syncableSessionIds.has(e.sessionId),
  )
  return {
    settings: settings ?? { ...NullAppSettings },
    litters,
    kittens,
    feedingSessions: syncableSessions,
    weightEntries: syncableEntries,
  }
}

export async function pushLocalToActive(
  token: string,
  folderId: string,
  existingFileId?: string,
): Promise<string> {
  const snapshot = await snapshotLocal()
  const json = snapshotToJson(snapshot)
  return await writeFile(token, {
    name: ACTIVE_FILE_NAME,
    parentId: folderId,
    content: json,
    ...(existingFileId !== undefined ? { existingFileId } : {}),
  })
}

export async function pullActiveToLocal(file: ActiveFile): Promise<void> {
  await wipeAllData()
  await db.transaction(
    'rw',
    [
      db.litters,
      db.kittens,
      db.settings,
      db.feedingSessions,
      db.weightEntries,
    ],
    async () => {
      if (file.litters.length > 0) await db.litters.bulkAdd([...file.litters])
      if (file.kittens.length > 0) await db.kittens.bulkAdd([...file.kittens])
      if (file.feedingSessions.length > 0) {
        await db.feedingSessions.bulkAdd([...file.feedingSessions])
      }
      if (file.weightEntries.length > 0) {
        await db.weightEntries.bulkAdd([...file.weightEntries])
      }
      await db.settings.put({ ...file.settings, id: SETTINGS_SINGLETON_ID })
    },
  )
}

export async function hasAnyLocalData(): Promise<boolean> {
  const [litters, sessions] = await Promise.all([
    db.litters.count(),
    db.feedingSessions.count(),
  ])
  return litters > 0 || sessions > 0
}
