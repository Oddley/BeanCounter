import {
  CURRENT_SCHEMA_VERSION,
  type ActiveFile,
  type ActiveFileSnapshot,
} from './types'

export function snapshotToJson(snapshot: ActiveFileSnapshot): string {
  const file: ActiveFile = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: snapshot.settings,
    litters: snapshot.litters,
    kittens: snapshot.kittens,
    feedingSessions: snapshot.feedingSessions,
    weightEntries: snapshot.weightEntries,
  }
  return JSON.stringify(file)
}
