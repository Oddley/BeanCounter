import { v4 as uuidv4 } from 'uuid'

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export function newId(): string {
  return uuidv4()
}

export function isValidId(id: string): boolean {
  return UUID_V4_PATTERN.test(id)
}
