import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'a',
  'div',
  'span',
]

const ALLOWED_ATTR = ['href', 'title', 'target', 'rel']

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html ?? '', {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'img', 'svg'],
    FORBID_ATTR: ['style', 'onerror', 'onclick', 'onload'],
  })
}

export function plainTextFromHtml(html: string): string {
  // Prefer the fast path for bulk search/export; avoid DOMParser on large datasets.
  return (html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isAllowedLinkHref(href: string): boolean {
  const trimmed = href.trim()
  const lower = trimmed.toLowerCase()
  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('file:') ||
    trimmed.startsWith('\\\\') ||
    /^[a-zA-Z]:[\\/]/.test(trimmed) ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../')
  )
}

export function ensureLinkSafety(html: string): string {
  const clean = sanitizeHtml(html)
  const doc = new DOMParser().parseFromString(clean, 'text/html')
  doc.querySelectorAll('a').forEach((anchor) => {
    const href = anchor.getAttribute('href') || ''
    if (!isAllowedLinkHref(href)) {
      anchor.removeAttribute('href')
    } else {
      anchor.setAttribute('rel', 'noopener noreferrer')
      if (!anchor.getAttribute('target')) {
        anchor.setAttribute('target', '_blank')
      }
    }
  })
  return doc.body.innerHTML
}
