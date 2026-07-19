import { type KittenSeries } from './types'

export const KITTEN_COLOR_PALETTE: readonly string[] = [
  '#f5b400',
  '#4ade80',
  '#60a5fa',
  '#f472b6',
  '#a78bfa',
  '#fb923c',
  '#22d3ee',
  '#facc15',
]

const FALLBACK_COLOR = '#f5b400'

// Resolves the plotted color for each series: an explicit override wins;
// otherwise the next palette color not already claimed by an earlier
// series in the list (whether by override or by an earlier default
// assignment) is used. A single left-to-right pass, so a kitten's default
// can be influenced by overrides earlier in the list but not later ones.
export function resolveSeriesColors(
  seriesList: readonly KittenSeries[],
): ReadonlyMap<string, string> {
  const used = new Set<string>()
  const resolved = new Map<string, string>()
  let paletteIndex = 0

  for (const series of seriesList) {
    if (series.color !== '') {
      resolved.set(series.kittenId, series.color)
      used.add(series.color)
      continue
    }
    const { color, nextIndex } = nextUnusedColor(paletteIndex, used)
    resolved.set(series.kittenId, color)
    used.add(color)
    paletteIndex = nextIndex
  }

  return resolved
}

function nextUnusedColor(
  startIndex: number,
  used: ReadonlySet<string>,
): { color: string; nextIndex: number } {
  for (let i = 0; i < KITTEN_COLOR_PALETTE.length; i++) {
    const idx = (startIndex + i) % KITTEN_COLOR_PALETTE.length
    const candidate = KITTEN_COLOR_PALETTE[idx] ?? FALLBACK_COLOR
    if (!used.has(candidate)) {
      return { color: candidate, nextIndex: idx + 1 }
    }
  }
  // Every palette color is already claimed by an override — fall back to
  // cycling through the palette anyway (a duplicate color is an acceptable
  // degrade; this only happens with 9+ simultaneously plotted kittens).
  const idx = startIndex % KITTEN_COLOR_PALETTE.length
  return { color: KITTEN_COLOR_PALETTE[idx] ?? FALLBACK_COLOR, nextIndex: idx + 1 }
}
