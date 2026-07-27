import { describe, expect, it } from 'vitest'
import {
  countDistinctLinkedRequirements,
  requirementSourceLinkEndpoints,
} from './sourceLinks'

describe('requirement-source link helpers', () => {
  it('points a relationship from the requirement toward the source', () => {
    expect(
      requirementSourceLinkEndpoints({
        requirementId: 'requirement-1',
        sourceId: 'source-1',
      }),
    ).toEqual({
      fromId: 'requirement-1',
      toId: 'source-1',
    })
  })

  it('counts each linked requirement only once per source', () => {
    const links = [
      { requirementId: 'requirement-1', sourceId: 'source-1' },
      { requirementId: 'requirement-1', sourceId: 'source-1' },
      { requirementId: 'requirement-2', sourceId: 'source-1' },
      { requirementId: 'requirement-3', sourceId: 'source-2' },
    ]

    expect(countDistinctLinkedRequirements(links, 'source-1')).toBe(2)
    expect(countDistinctLinkedRequirements(links, 'source-2')).toBe(1)
  })
})
