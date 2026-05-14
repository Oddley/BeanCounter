import { type AppSettings } from './types'

export function setStickyLitter(
  settings: AppSettings,
  litterId: string,
  now: number,
): AppSettings {
  return { ...settings, stickyLitterId: litterId, lastUpdatedAt: now }
}

export function clearStickyLitter(
  settings: AppSettings,
  now: number,
): AppSettings {
  return { ...settings, stickyLitterId: '', lastUpdatedAt: now }
}

export function hasStickyLitter(settings: AppSettings): boolean {
  return settings.stickyLitterId !== ''
}
