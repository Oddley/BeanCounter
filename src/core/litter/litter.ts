import {
  type Litter,
  type LitterValidationResult,
  MAX_LITTER_NAME_LENGTH,
} from './types'

export function createLitter(input: { id: string; name: string }): Litter {
  return {
    id: input.id,
    name: input.name.trim(),
    active: true,
    sheetTabId: '',
  }
}

export function archiveLitter(litter: Litter): Litter {
  return { ...litter, active: false }
}

export function activateLitter(litter: Litter): Litter {
  return { ...litter, active: true }
}

export function renameLitter(litter: Litter, newName: string): Litter {
  return { ...litter, name: newName.trim() }
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
