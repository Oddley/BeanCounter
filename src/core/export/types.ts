export interface ExportKitten {
  readonly id: string
  readonly displayName: string
  readonly order: number
}

export interface ExportSession {
  readonly id: string
  readonly createdAt: number
  readonly recordedAt: number
}

export interface ExportEntry {
  readonly sessionId: string
  readonly kittenId: string
  readonly grams: number
}

export interface BuildCsvInput {
  readonly kittens: readonly ExportKitten[]
  readonly sessions: readonly ExportSession[]
  readonly entries: readonly ExportEntry[]
}
