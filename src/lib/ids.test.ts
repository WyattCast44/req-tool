import { describe, expect, it } from 'vitest'
import { suggestNextRequirementSourceId } from './ids'

describe('suggestNextRequirementSourceId', () => {
  it('defaults to REQ-001 when no IDs exist', () => {
    expect(suggestNextRequirementSourceId([])).toBe('REQ-001')
  })

  it('increments the highest matching numeric ID', () => {
    expect(suggestNextRequirementSourceId(['SRD-001', 'SRD-002', 'SRD-010'])).toBe('SRD-011')
  })

  it('preserves zero padding width', () => {
    expect(suggestNextRequirementSourceId(['REQ-001', 'REQ-009'])).toBe('REQ-010')
  })

  it('prefers a prefix hint from the source document identifier', () => {
    expect(
      suggestNextRequirementSourceId(['SRD-001', 'SRD-002', 'ICD-100'], 'SRD'),
    ).toBe('SRD-003')
  })

  it('starts a new series from the prefix hint when unused', () => {
    expect(suggestNextRequirementSourceId(['REQ-001'], 'SRD')).toBe('SRD-001')
  })

  it('uses the most common family when no hint is provided', () => {
    expect(
      suggestNextRequirementSourceId(['SRD-001', 'SRD-002', 'ICD-1', 'SRD-005']),
    ).toBe('SRD-006')
  })
})
