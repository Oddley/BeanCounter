import {
  type WeightEntry,
  type WeightValidationResult,
  MIN_GRAMS,
  MAX_GRAMS,
} from './types'

export function weightEntryId(sessionId: string, kittenId: string): string {
  return `${sessionId}:${kittenId}`
}

export function createWeightEntry(input: {
  sessionId: string
  kittenId: string
  grams: number
  timestamp: number
  clientWriteId: string
}): WeightEntry {
  return {
    id: weightEntryId(input.sessionId, input.kittenId),
    sessionId: input.sessionId,
    kittenId: input.kittenId,
    grams: input.grams,
    timestamp: input.timestamp,
    clientWriteId: input.clientWriteId,
  }
}

export function validateGrams(grams: number): WeightValidationResult {
  const errors: string[] = []
  if (!Number.isFinite(grams) || Number.isNaN(grams)) {
    errors.push('Weight must be a number')
  } else if (!Number.isInteger(grams)) {
    errors.push('Weight must be a whole number of grams')
  } else if (grams < MIN_GRAMS) {
    errors.push('Weight must be positive')
  } else if (grams > MAX_GRAMS) {
    errors.push(`Weight exceeds reasonable kitten range (max ${MAX_GRAMS}g)`)
  }
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  })
}
