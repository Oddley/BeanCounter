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
): Promise<InspectionResult> {
  const escapedName = escapeDriveQueryString(ACTIVE_FILE_NAME)
  const matches = await listFiles(
    token,
    `'${folderId}' in parents and name = '${escapedName}' and trashed = false`,
  )
  const first = matches[0]
  if (first === undefined) {
    return { kind: 'empty', folderId }
  }
  const content = await readFileContent(token, first.id)
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
  return {
    settings: settings ?? { ...NullAppSettings },
    litters,
    kittens,
    feedingSessions: sessions,
    weightEntries,
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
