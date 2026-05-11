import {
  type Kitten,
  type KittenValidationResult,
  MAX_KITTEN_NAME_LENGTH,
} from './types'

export function createKitten(input: {
  id: string
  litterId: string
  displayName: string
  order: number
}): Kitten {
  return {
    id: input.id,
    litterId: input.litterId,
    displayName: input.displayName.trim(),
    active: true,
    order: input.order,
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

export function reassignOrders(orderedKittens: readonly Kitten[]): Kitten[] {
  return orderedKittens.map((k, i) => ({ ...k, order: i }))
}

export function moveKittenUp(
  kittens: readonly Kitten[],
  index: number,
): Kitten[] {
  if (index <= 0 || index >= kittens.length) return [...kittens]
  const copy = [...kittens]
  const prev = copy[index - 1]
  const cur = copy[index]
  if (prev === undefined || cur === undefined) return [...kittens]
  copy[index - 1] = cur
  copy[index] = prev
  return reassignOrders(copy)
}

export function moveKittenDown(
  kittens: readonly Kitten[],
  index: number,
): Kitten[] {
  if (index < 0 || index >= kittens.length - 1) return [...kittens]
  const copy = [...kittens]
  const cur = copy[index]
  const next = copy[index + 1]
  if (cur === undefined || next === undefined) return [...kittens]
  copy[index] = next
  copy[index + 1] = cur
  return reassignOrders(copy)
}
