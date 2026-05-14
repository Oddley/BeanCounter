import {
  type Litter,
  type LitterValidationResult,
  MAX_LITTER_NAME_LENGTH,
} from './types'

export function createLitter(input: {
  id: string
  name: string
  now: number
}): Litter {
  return {
    id: input.id,
    name: input.name.trim(),
    active: true,
    lastUpdatedAt: input.now,
  }
}

export function archiveLitter(litter: Litter, now: number): Litter {
  return { ...litter, active: false, lastUpdatedAt: now }
}

export function activateLitter(litter: Litter, now: number): Litter {
  return { ...litter, active: true, lastUpdatedAt: now }
}

export function renameLitter(
  litter: Litter,
  newName: string,
  now: number,
): Litter {
  return { ...litter, name: newName.trim(), lastUpdatedAt: now }
}

export function validateLitterName(name: string): LitterValidationResult {
  const errors: string[] = []
  const trimmed = name.trim()
  if (trimmed.length === 0) {
    errors.push('Name cannot be empty')
  }
  if (trimmed.length > MAX_LITTER_NAME_LENGTH) {
    errors.push(`Name cannot exceed ${MAX_LITTER_NAME_LENGTH} characters`)
  }
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  })
}
