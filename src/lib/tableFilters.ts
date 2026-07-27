/** Strip markup so rich-text fields can participate in column filters. */
export function plainTextFromHtml(html: unknown): string {
  return String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

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
