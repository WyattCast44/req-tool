import { describe, expect, it } from 'vitest'
import { isAllowedLinkHref } from './sanitize'

describe('isAllowedLinkHref', () => {
  it.each([
    'https://example.test/report',
    'http://example.test/report',
    'file:///Users/test/report.pdf',
    '\\\\server\\share\\report.pdf',
    'C:\\evidence\\report.pdf',
    '/evidence/report.pdf',
    './evidence/report.pdf',
    '../evidence/report.pdf',
  ])('allows supported web and file targets: %s', (href) => {
    expect(isAllowedLinkHref(href)).toBe(true)
  })

  it.each([
    '',
    'javascript:alert(1)',
    'data:text/html,unsafe',
    'mailto:user@example.test',
    'example.test/report',
  ])('rejects unsupported targets: %s', (href) => {
    expect(isAllowedLinkHref(href)).toBe(false)
  })
})
