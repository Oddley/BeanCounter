import {
  type Kitten,
  type KittenValidationResult,
  MAX_KITTEN_NAME_LENGTH,
} from './types'

export function createKitten(input: {
  id: string
  litterId: string
  displayName: string
}): Kitten {
  return {
    id: input.id,
    litterId: input.litterId,
    displayName: input.displayName.trim(),
    active: true,
  }
}

export function archiveKitten(kitten: Kitten): Kitten {
  return { ...kitten, active: false }
}

export function activateKitten(kitten: Kitten): Kitten {
  return { ...kitten, active: true }
}

export function renameKitten(kitten: Kitten, newDisplayName: string): Kitten {
  return { ...kitten, displayName: newDisplayName.trim() }
}

export function validateKittenName(name: string): KittenValidationResult {
  const errors: string[] = []
  const trimmed = name.trim()
  if (trimmed.length === 0) {
    errors.push('Name cannot be empty')
  }
  if (trimmed.length > MAX_KITTEN_NAME_LENGTH) {
    errors.push(`Name cannot exceed ${MAX_KITTEN_NAME_LENGTH} characters`)
  }
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  })
}

export function defaultKittenName(index: number): string {
  return `Kitten ${index}`
}
