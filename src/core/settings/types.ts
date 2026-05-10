export interface AppSettings {
  readonly stickyLitterId: string
}

export const NullAppSettings: AppSettings = Object.freeze({
  stickyLitterId: '',
})
