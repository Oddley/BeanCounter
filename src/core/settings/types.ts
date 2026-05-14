export interface AppSettings {
  readonly stickyLitterId: string
  readonly lastUpdatedAt: number
}

export const NullAppSettings: AppSettings = Object.freeze({
  stickyLitterId: '',
  lastUpdatedAt: 0,
})
