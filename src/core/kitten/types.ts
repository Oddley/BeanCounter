export interface Kitten {
  readonly id: string
  readonly displayName: string
  readonly active: boolean
  readonly litterId: string
  readonly order: number
}

export const NullKitten: Kitten = Object.freeze({
  id: '',
  displayName: 'Unknown',
  active: false,
  litterId: '',
  order: 0,
})

export interface KittenValidationResult {
  readonly valid: boolean
  readonly errors: readonly string[]
}

export const MAX_KITTEN_NAME_LENGTH = 50
