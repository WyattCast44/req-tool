import type { RequirementSourceLink } from '../types/project'

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
