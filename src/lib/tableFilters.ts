/** Convenience text filter used by most string columns. */
export function fuzzyIncludesFilter(rowValue: unknown, filterValue: unknown): boolean {
  const query = String(filterValue ?? '')
    .trim()
    .toLowerCase()
  if (!query) return true
  return String(rowValue ?? '')
    .toLowerCase()
    .includes(query)
}
