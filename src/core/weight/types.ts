export interface WeightEntry {
  readonly id: string
  readonly sessionId: string
  readonly kittenId: string
  readonly grams: number
  readonly timestamp: number
  readonly clientWriteId: string
}

export const NullWeightEntry: WeightEntry = Object.freeze({
  id: '',
  sessionId: '',
  kittenId: '',
  grams: 0,
  timestamp: 0,
  clientWriteId: '',
})

export interface WeightValidationResult {
  readonly valid: boolean
  readonly errors: readonly string[]
}

export const MIN_GRAMS = 1
export const MAX_GRAMS = 5000
