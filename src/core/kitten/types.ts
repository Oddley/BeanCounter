export interface Kitten {
  readonly id: string
  readonly displayName: string
  readonly active: boolean
  readonly litterId: string
  readonly order: number
  readonly lastUpdatedAt: number
  // '' means "no override — use the graph's default palette color".
  // Non-empty is a '#rrggbb' hex string the user chose explicitly.
  readonly color: string
}

export const NullKitten: Kitten = Object.freeze({
  id: '',
  displayName: 'Unknown',
  active: false,
  litterId: '',
  order: 0,
  lastUpdatedAt: 0,
  color: '',
})

export interface KittenValidationResult {
  readonly valid: boolean
  readonly errors: readonly string[]
}

export const MAX_KITTEN_NAME_LENGTH = 50
