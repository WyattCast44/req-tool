import { v4 as uuidv4 } from 'uuid'

export function newId(): string {
  return uuidv4()
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString()
}

export function slugifyFilename(value: string): string {
  return value
    .trim()
    .replace(/[^\w-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80) || 'Project'
}

interface ParsedRequirementId {
  prefix: string
  number: number
  width: number
}

const ID_PATTERN = /^(.*?)(\d+)$/

function parseRequirementSourceId(value: string): ParsedRequirementId | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = trimmed.match(ID_PATTERN)
  if (!match) return null
  const prefix = match[1]
  const digits = match[2]
  if (!prefix) return null
  return {
    prefix,
    number: Number(digits),
    width: digits.length,
  }
}

function normalizePrefixHint(hint: string | null | undefined): string | null {
  const trimmed = hint?.trim()
  if (!trimmed) return null
  if (/[-_\s]$/.test(trimmed)) return trimmed
  return `${trimmed}-`
}

/**
 * Suggest the next requirement source ID from existing IDs.
 * Prefers IDs that share a prefix hint (e.g. a source document identifier),
 * otherwise uses the most common numeric ID family in the project.
 */
export function suggestNextRequirementSourceId(
  existingIds: string[],
  prefixHint?: string | null,
): string {
  const parsed = existingIds
    .map(parseRequirementSourceId)
    .filter((item): item is ParsedRequirementId => Boolean(item))

  const preferredPrefix = normalizePrefixHint(prefixHint)
  const preferred = preferredPrefix
    ? parsed.filter((item) => item.prefix.toLowerCase() === preferredPrefix.toLowerCase())
    : []

  if (preferredPrefix && preferred.length === 0) {
    return `${preferredPrefix}001`
  }

  const candidates = preferred.length > 0 ? preferred : parsed
  if (candidates.length === 0) {
    return 'REQ-001'
  }

  // Prefer the most common prefix among candidates, then highest number.
  const prefixCounts = new Map<string, { count: number; width: number; max: number }>()
  for (const item of candidates) {
    const key = item.prefix
    const current = prefixCounts.get(key) || { count: 0, width: item.width, max: 0 }
    current.count += 1
    current.width = Math.max(current.width, item.width)
    current.max = Math.max(current.max, item.number)
    prefixCounts.set(key, current)
  }

  let bestPrefix = candidates[0].prefix
  let best = prefixCounts.get(bestPrefix)!
  for (const [prefix, stats] of prefixCounts) {
    if (
      stats.count > best.count ||
      (stats.count === best.count && stats.max > best.max)
    ) {
      bestPrefix = prefix
      best = stats
    }
  }

  const nextNumber = best.max + 1
  return `${bestPrefix}${String(nextNumber).padStart(best.width, '0')}`
}
