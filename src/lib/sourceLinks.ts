import type { Requirement, RequirementSourceLink } from '../types/project'

type RequirementSourceIdentity = Pick<RequirementSourceLink, 'requirementId' | 'sourceId'>

export function requirementSourceLinkEndpoints(link: RequirementSourceIdentity) {
  return {
    fromId: link.requirementId,
    toId: link.sourceId,
  }
}

export function countDistinctLinkedRequirements(
  links: readonly RequirementSourceIdentity[] | undefined,
  sourceId: string | undefined,
): number {
  if (!sourceId) return 0
  return new Set(
    (links ?? [])
      .filter((link) => link.sourceId === sourceId)
      .map((link) => link.requirementId),
  ).size
}

/** Count requirements that list this Source as their primary source document. */
export function countRequirementsForSource(
  requirements: readonly Pick<Requirement, 'sourceDocumentId'>[] | undefined,
  sourceId: string | undefined,
): number {
  if (!sourceId) return 0
  return (requirements ?? []).filter((requirement) => requirement.sourceDocumentId === sourceId).length
}
