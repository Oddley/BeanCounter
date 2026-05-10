export interface Kitten {
  readonly id: string
  readonly displayName: string
  readonly active: boolean
  readonly litterId: string
}

export const NullKitten: Kitten = Object.freeze({
  id: '',
  displayName: 'Unknown',
  active: false,
  litterId: '',
})

export interface KittenValidationResult {
  readonly valid: boolean
  readonly errors: readonly string[]
}

export const MAX_KITTEN_NAME_LENGTH = 50
