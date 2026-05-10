import { type AppSettings } from './types'

export function setStickyLitter(
  settings: AppSettings,
  litterId: string,
): AppSettings {
  return { ...settings, stickyLitterId: litterId }
}

export function clearStickyLitter(settings: AppSettings): AppSettings {
  return { ...settings, stickyLitterId: '' }
}

export function hasStickyLitter(settings: AppSettings): boolean {
  return settings.stickyLitterId !== ''
}
