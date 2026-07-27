/** Higher score = better match. Zero means no match. */
export function fuzzyScore(haystack: string, query: string): number {
  const h = haystack.toLowerCase()
  const q = query.trim().toLowerCase()
  if (!q) return 1
  if (h === q) return 100
  if (h.startsWith(q)) return 90

  const index = h.indexOf(q)
  if (index >= 0) return 70 - Math.min(index, 20)

  // Contiguous token starts (e.g. "nav bar" → "navigation bar")
  const tokens = h.split(/[^a-z0-9]+/).filter(Boolean)
  if (tokens.some((token) => token.startsWith(q))) return 60

  // Subsequence match: characters in order, not necessarily contiguous
  let cursor = 0
  for (const ch of q) {
    const next = h.indexOf(ch, cursor)
    if (next < 0) return 0
    cursor = next + 1
  }
  return 30
}

/** Filter and rank items by fuzzy match against extracted search text. */
export function fuzzyFilterRanked<T>(
  items: T[],
  query: string,
  getText: (item: T) => string,
  limit?: number,
): T[] {
  const q = query.trim()
  if (!q) return limit ? items.slice(0, limit) : items

  const scored = items
    .map((item) => ({ item, score: fuzzyScore(getText(item), q) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || getText(a.item).localeCompare(getText(b.item)))

  const ranked = scored.map((entry) => entry.item)
  return limit ? ranked.slice(0, limit) : ranked
}

export function withClearOption<T>(items: readonly T[], clearOption: T, query: string): T[] {
  return query.trim() ? [...items, clearOption] : [clearOption, ...items]
}
