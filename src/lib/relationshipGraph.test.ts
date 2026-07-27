import { describe, expect, it } from 'vitest'
import { createTestProject, createTestRequirement } from '../test/projectFactory'
import type {
  RequirementRelationship,
  RequirementSourceLink,
  Source,
} from '../types/project'
import {
  buildGraphNeighborhood,
  graphElementDefinitions,
  type BuildGraphNeighborhoodOptions,
} from './relationshipGraph'

const timestamp = '2026-07-26T12:00:00.000Z'

function relationship(
  id: string,
  sourceRequirementId: string,
  targetRequirementId: string,
  type: RequirementRelationship['type'] = 'Supports',
): RequirementRelationship {
  return {
    id,
    sourceRequirementId,
    targetRequirementId,
    type,
    rationale: '',
    notes: '',
    createdAt: timestamp,
    modifiedAt: timestamp,
    editorName: 'Test Analyst',
  }
}

function graphOptions(
  overrides: Partial<BuildGraphNeighborhoodOptions> = {},
): BuildGraphNeighborhoodOptions {
  const project = createTestProject()
  const first = createTestRequirement(project, 'first')
  const second = createTestRequirement(project, 'second')
  const third = createTestRequirement(project, 'third')
  project.requirements = [first, second, third]
  project.relationships = [
    relationship('rel-1', first.id, second.id),
    relationship('rel-2', second.id, third.id),
  ]
  return {
    project,
    focusId: first.id,
    focusKind: 'requirement',
    depth: 1,
    relationshipTypes: ['Supports'],
    sourceLinkTypes: [],
    statusIds: [],
    tagIds: [],
    ...overrides,
  }
}

describe('relationship graph neighborhoods', () => {
  it('expands requirement relationships to the requested depth', () => {
    const depthOne = buildGraphNeighborhood(graphOptions())
    const depthTwo = buildGraphNeighborhood(graphOptions({ depth: 2 }))

    expect(depthOne.nodes.map((node) => node.id)).toEqual(['first', 'second'])
    expect(depthOne.edges.map((edge) => edge.id)).toEqual(['rel-1'])
    expect(depthTwo.nodes.map((node) => node.id)).toEqual([
      'first',
      'second',
      'third',
    ])
    expect(depthTwo.edges.map((edge) => edge.id)).toEqual(['rel-1', 'rel-2'])
  })

  it('keeps a filtered requirement focus while filtering its neighbors', () => {
    const options = graphOptions()
    const otherStatusId = options.project.lookups.statuses.find(
      (status) => status.id !== options.project.requirements[0].statusId,
    )!.id
    options.project.requirements[1].statusId = otherStatusId

    const neighborhood = buildGraphNeighborhood({
      ...options,
      statusIds: [otherStatusId],
    })

    expect(neighborhood.nodes.map((node) => node.id)).toEqual(['first', 'second'])
    expect(neighborhood.edges.map((edge) => edge.id)).toEqual(['rel-1'])
  })

  it('includes source links and expands requirement relationships after depth one', () => {
    const options = graphOptions()
    const source: Source = {
      id: 'source-1',
      identifier: 'STD-1',
      title: 'Source standard',
      sourceType: '',
      version: '',
      publisher: '',
      publicationDate: '',
      url: '',
      filePath: '',
      description: '',
      notes: '',
      createdAt: timestamp,
      modifiedAt: timestamp,
      editorName: 'Test Analyst',
    }
    const sourceLink: RequirementSourceLink = {
      id: 'source-link-1',
      requirementId: 'first',
      sourceId: source.id,
      type: 'Cites',
      locator: '',
      rationale: '',
      notes: '',
      createdAt: timestamp,
      modifiedAt: timestamp,
      editorName: 'Test Analyst',
    }
    options.project.sources = [source]
    options.project.requirementSourceLinks = [sourceLink]

    const depthOne = buildGraphNeighborhood({
      ...options,
      focusId: source.id,
      focusKind: 'source',
      sourceLinkTypes: ['Cites'],
    })
    const depthTwo = buildGraphNeighborhood({
      ...options,
      focusId: source.id,
      focusKind: 'source',
      sourceLinkTypes: ['Cites'],
      depth: 2,
    })

    expect(depthOne.nodes.map((node) => node.id)).toEqual(['source-1', 'first'])
    expect(depthOne.edges.map((edge) => edge.id)).toEqual(['source-link-1'])
    expect(depthTwo.nodes.map((node) => node.id)).toEqual([
      'source-1',
      'first',
      'second',
    ])
    expect(depthTwo.edges.map((edge) => edge.id)).toEqual([
      'source-link-1',
      'rel-1',
    ])
  })

  it('omits relationships whose endpoint requirement is missing', () => {
    const options = graphOptions()
    options.project.relationships = [
      relationship('dangling-edge', 'first', 'missing-requirement'),
    ]

    const neighborhood = buildGraphNeighborhood(options)
    const elements = graphElementDefinitions(neighborhood)

    expect(neighborhood.nodes.map((node) => node.id)).toEqual(['first'])
    expect(neighborhood.edges).toEqual([])
    expect(elements.map((element) => element.data.id)).toEqual(['first'])
  })

  it('omits source links whose requirement endpoint is missing', () => {
    const options = graphOptions()
    const source: Source = {
      id: 'source-1',
      identifier: 'STD-1',
      title: 'Source standard',
      sourceType: '',
      version: '',
      publisher: '',
      publicationDate: '',
      url: '',
      filePath: '',
      description: '',
      notes: '',
      createdAt: timestamp,
      modifiedAt: timestamp,
      editorName: 'Test Analyst',
    }
    options.project.sources = [source]
    options.project.requirementSourceLinks = [
      {
        id: 'dangling-source-link',
        requirementId: 'missing-requirement',
        sourceId: source.id,
        type: 'Cites',
        locator: '',
        rationale: '',
        notes: '',
        createdAt: timestamp,
        modifiedAt: timestamp,
        editorName: 'Test Analyst',
      },
    ]

    const neighborhood = buildGraphNeighborhood({
      ...options,
      focusId: source.id,
      focusKind: 'source',
      sourceLinkTypes: ['Cites'],
    })
    const elements = graphElementDefinitions(neighborhood)

    expect(neighborhood.nodes.map((node) => node.id)).toEqual(['source-1'])
    expect(neighborhood.edges).toEqual([])
    expect(elements.map((element) => element.data.id)).toEqual(['source-1'])
  })
})

describe('Cytoscape element mapping', () => {
  it('reverses Child of for display while preserving stable IDs', () => {
    const options = graphOptions()
    options.project.relationships = [
      relationship('child-edge', 'first', 'second', 'Child of'),
    ]
    const neighborhood = buildGraphNeighborhood({
      ...options,
      relationshipTypes: ['Child of'],
    })
    const edge = graphElementDefinitions(neighborhood).find(
      (element) => element.data.id === 'child-edge',
    )

    expect(edge?.data).toMatchObject({
      id: 'child-edge',
      source: 'second',
      target: 'first',
      label: 'Parent of',
      kind: 'relationship',
    })
  })
})
