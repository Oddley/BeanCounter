export interface Litter {
  readonly id: string
  readonly name: string
  readonly active: boolean
  readonly lastUpdatedAt: number
}

export const NullLitter: Litter = Object.freeze({
  id: '',
  name: 'Unknown',
  active: false,
  lastUpdatedAt: 0,
})

export interface LitterValidationResult {
  readonly valid: boolean
  readonly errors: readonly string[]
}

export const MAX_LITTER_NAME_LENGTH = 100
