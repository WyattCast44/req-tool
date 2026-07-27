import type { ElementDefinition } from 'cytoscape'
import type {
  ProjectData,
  RelationshipType,
  RequirementRelationship,
  RequirementSourceLink,
  SourceRelationshipType,
} from '../types/project'
import { requirementSourceLinkEndpoints } from './sourceLinks'

export type GraphFocusKind = 'requirement' | 'source'

export type GraphNode =
  | { id: string; kind: 'requirement'; label: string }
  | { id: string; kind: 'source'; label: string }

export type GraphEdge =
  | {
      kind: 'relationship'
      id: string
      fromId: string
      toId: string
      type: RelationshipType
      relationship: RequirementRelationship
    }
  | {
      kind: 'source-link'
      id: string
      fromId: string
      toId: string
      type: SourceRelationshipType
      link: RequirementSourceLink
    }

export interface GraphNeighborhood {
  nodes: GraphNode[]
  edges: GraphEdge[]
  focusNodeId: string | null
  focusKind: GraphFocusKind
}

export interface BuildGraphNeighborhoodOptions {
  project: ProjectData
  focusId: string | null
  focusKind: GraphFocusKind
  depth: number
  relationshipTypes: readonly RelationshipType[]
  sourceLinkTypes: readonly SourceRelationshipType[]
  statusIds: readonly string[]
  tagIds: readonly string[]
}

function requirementLabel(sourceId: string): string {
  return sourceId.length > 8 ? `${sourceId.slice(0, 8)}…` : sourceId
}

function sourceLabel(identifier: string, title: string): string {
  const label = identifier || title
  return label.length > 9 ? `${label.slice(0, 9)}…` : label
}

export function buildGraphNeighborhood({
  project,
  focusId,
  focusKind,
  depth,
  relationshipTypes,
  sourceLinkTypes,
  statusIds,
  tagIds,
}: BuildGraphNeighborhoodOptions): GraphNeighborhood {
  const empty: GraphNeighborhood = {
    nodes: [],
    edges: [],
    focusNodeId: null,
    focusKind,
  }
  if (!focusId) return empty

  const allowedRelationships = new Set(relationshipTypes)
  const allowedSourceLinks = new Set(sourceLinkTypes)
  const requirementsById = new Map(
    project.requirements.map((requirement) => [requirement.id, requirement]),
  )
  const adjacency = new Map<string, string[]>()

  for (const relationship of project.relationships) {
    if (!allowedRelationships.has(relationship.type)) continue
    const sourceNeighbors = adjacency.get(relationship.sourceRequirementId) ?? []
    sourceNeighbors.push(relationship.targetRequirementId)
    adjacency.set(relationship.sourceRequirementId, sourceNeighbors)
    const targetNeighbors = adjacency.get(relationship.targetRequirementId) ?? []
    targetNeighbors.push(relationship.sourceRequirementId)
    adjacency.set(relationship.targetRequirementId, targetNeighbors)
  }

  const requirementIds = new Set<string>()
  const sourceEdges: GraphEdge[] = []
  let frontier: string[] = []
  let expansionLevels = depth

  if (focusKind === 'source') {
    const source = project.sources.find((item) => item.id === focusId)
    if (!source) return empty

    for (const link of project.requirementSourceLinks) {
      if (link.sourceId !== focusId || !allowedSourceLinks.has(link.type)) continue
      requirementIds.add(link.requirementId)
      sourceEdges.push({
        kind: 'source-link',
        id: link.id,
        ...requirementSourceLinkEndpoints(link),
        type: link.type,
        link,
      })
    }
    frontier = Array.from(requirementIds)
    expansionLevels = Math.max(0, depth - 1)
  } else {
    requirementIds.add(focusId)
    frontier = [focusId]
  }

  for (let level = 0; level < expansionLevels && frontier.length > 0; level += 1) {
    const next: string[] = []
    for (const requirementId of frontier) {
      for (const neighborId of adjacency.get(requirementId) ?? []) {
        if (requirementIds.has(neighborId)) continue
        requirementIds.add(neighborId)
        next.push(neighborId)
      }
    }
    frontier = next
  }

  let visibleRequirementIds = Array.from(requirementIds)
  if (statusIds.length > 0) {
    visibleRequirementIds = visibleRequirementIds.filter((id) => {
      const requirement = requirementsById.get(id)
      return requirement && statusIds.includes(requirement.statusId)
    })
  }
  if (tagIds.length > 0) {
    visibleRequirementIds = visibleRequirementIds.filter((id) => {
      const requirement = requirementsById.get(id)
      return requirement && tagIds.some((tagId) => requirement.tagIds.includes(tagId))
    })
  }
  if (
    focusKind === 'requirement' &&
    requirementsById.has(focusId) &&
    !visibleRequirementIds.includes(focusId)
  ) {
    visibleRequirementIds.unshift(focusId)
  }

  const visibleRequirementIdSet = new Set(visibleRequirementIds)
  const relationshipEdges: GraphEdge[] = project.relationships
    .filter(
      (relationship) =>
        allowedRelationships.has(relationship.type) &&
        visibleRequirementIdSet.has(relationship.sourceRequirementId) &&
        visibleRequirementIdSet.has(relationship.targetRequirementId),
    )
    .map((relationship) => ({
      kind: 'relationship',
      id: relationship.id,
      fromId: relationship.sourceRequirementId,
      toId: relationship.targetRequirementId,
      type: relationship.type,
      relationship,
    }))

  const candidateEdges =
    focusKind === 'source'
      ? [
          ...sourceEdges.filter((edge) => visibleRequirementIdSet.has(edge.fromId)),
          ...relationshipEdges,
        ]
      : relationshipEdges

  const nodes: GraphNode[] = []
  if (focusKind === 'source') {
    const source = project.sources.find((item) => item.id === focusId)
    if (source) {
      nodes.push({
        id: source.id,
        kind: 'source',
        label: sourceLabel(source.identifier, source.title),
      })
    }
  }
  for (const id of visibleRequirementIds) {
    const requirement = requirementsById.get(id)
    if (!requirement) continue
    nodes.push({
      id,
      kind: 'requirement',
      label: requirementLabel(requirement.sourceId),
    })
  }
  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges = candidateEdges.filter(
    (edge) => nodeIds.has(edge.fromId) && nodeIds.has(edge.toId),
  )

  return {
    nodes,
    edges,
    focusNodeId: focusId,
    focusKind,
  }
}

export interface GraphElementData {
  id: string
  kind: GraphNode['kind'] | GraphEdge['kind']
  label: string
  source?: string
  target?: string
}

export function graphElementDefinitions(
  neighborhood: GraphNeighborhood,
): ElementDefinition[] {
  const nodes: ElementDefinition[] = neighborhood.nodes.map((node) => ({
    data: {
      id: node.id,
      kind: node.kind,
      label: node.label,
    } satisfies GraphElementData,
    classes: [
      node.kind,
      node.id === neighborhood.focusNodeId ? 'focused' : '',
    ]
      .filter(Boolean)
      .join(' '),
  }))

  const edges: ElementDefinition[] = neighborhood.edges.map((edge) => {
    const reverseChildRelationship =
      edge.kind === 'relationship' && edge.type === 'Child of'
    const source = reverseChildRelationship ? edge.toId : edge.fromId
    const target = reverseChildRelationship ? edge.fromId : edge.toId
    return {
      data: {
        id: edge.id,
        kind: edge.kind,
        label: reverseChildRelationship ? 'Parent of' : edge.type,
        source,
        target,
      } satisfies GraphElementData,
      classes: edge.kind,
    }
  })

  return [...nodes, ...edges]
}
