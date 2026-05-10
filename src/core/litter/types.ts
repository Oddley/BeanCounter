export interface Litter {
  readonly id: string
  readonly name: string
  readonly active: boolean
  readonly sheetTabId: string
}

export const NullLitter: Litter = Object.freeze({
  id: '',
  name: 'Unknown',
  active: false,
  sheetTabId: '',
})

export interface LitterValidationResult {
  readonly valid: boolean
  readonly errors: readonly string[]
}

export const MAX_LITTER_NAME_LENGTH = 100
