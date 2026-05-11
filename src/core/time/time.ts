export function startOfLocalDay(millis: number): number {
  const d = new Date(millis)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime()
}

export function isSameLocalDay(a: number, b: number): boolean {
  return startOfLocalDay(a) === startOfLocalDay(b)
}

export function localDayKey(millis: number): string {
  const d = new Date(millis)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function addDays(millis: number, days: number): number {
  const d = new Date(millis)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

export function localDayDiff(later: number, earlier: number): number {
  const laterDay = startOfLocalDay(later)
  const earlierDay = startOfLocalDay(earlier)
  const dayMs = 24 * 60 * 60 * 1000
  return Math.round((laterDay - earlierDay) / dayMs)
}
