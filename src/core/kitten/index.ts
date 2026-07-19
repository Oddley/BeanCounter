export type { Kitten, KittenValidationResult } from './types'
export { NullKitten, MAX_KITTEN_NAME_LENGTH } from './types'
export {
  createKitten,
  archiveKitten,
  activateKitten,
  renameKitten,
  setKittenColor,
  clearKittenColor,
  validateKittenColor,
  validateKittenName,
  defaultKittenName,
  reassignOrders,
  moveKittenUp,
  moveKittenDown,
} from './kitten'
