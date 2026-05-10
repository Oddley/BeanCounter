export {
  db,
  BeanCounterDB,
  SETTINGS_SINGLETON_ID,
  type SettingsRecord,
} from './dexie'

export {
  useActiveLitters,
  useArchivedLitters,
  useAllLitters,
  useLitter,
  useActiveKittens,
  useArchivedKittens,
  useAllKittens,
  useSettings,
} from './queries'

export {
  persistNewLitter,
  archiveLitterById,
  activateLitterById,
  renameLitterById,
  persistNewKitten,
  archiveKittenById,
  activateKittenById,
  renameKittenById,
  setStickyLitterById,
  clearStickyLitterById,
  wipeAllData,
  type NewLitterInput,
  type NewLitterResult,
} from './mutations'
