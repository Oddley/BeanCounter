import { type BuildCsvInput } from './types'

const GRAMS_PER_OUNCE = 0.035274

function effectiveTime(session: { createdAt: number; recordedAt: number }): number {
  return session.recordedAt > 0 ? session.recordedAt : session.createdAt
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function formatSessionHeader(session: { createdAt: number; recordedAt: number }): string {
  return new Date(effectiveTime(session)).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function buildCsv(input: BuildCsvInput): string {
  const sessions = [...input.sessions].sort(
    (a, b) => effectiveTime(a) - effectiveTime(b),
  )
  const kittens = [...input.kittens].sort((a, b) => a.order - b.order)

  const gramsMap = new Map<string, Map<string, number>>()
  for (const e of input.entries) {
    if (!gramsMap.has(e.sessionId)) gramsMap.set(e.sessionId, new Map())
    gramsMap.get(e.sessionId)!.set(e.kittenId, e.grams)
  }

  const sessionHeaders = sessions.map((s) => escapeCsv(formatSessionHeader(s)))

  const gramsHeader = ['Grams', ...sessionHeaders].join(',')
  const gramsRows = kittens.map((k) => {
    const cols = [escapeCsv(k.displayName)]
    for (const s of sessions) {
      const g = gramsMap.get(s.id)?.get(k.id)
      cols.push(g !== undefined ? String(g) : '')
    }
    return cols.join(',')
  })

  const ouncesHeader = ['Ounces', ...sessionHeaders].join(',')
  const ouncesRows = kittens.map((k) => {
    const cols = [escapeCsv(k.displayName)]
    for (const s of sessions) {
      const g = gramsMap.get(s.id)?.get(k.id)
      cols.push(g !== undefined ? (g * GRAMS_PER_OUNCE).toFixed(2) : '')
    }
    return cols.join(',')
  })

  return [gramsHeader, ...gramsRows, '', ouncesHeader, ...ouncesRows].join('\r\n')
}
