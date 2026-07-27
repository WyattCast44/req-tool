import type {
  AssessmentRecord,
  ProjectData,
  Requirement,
  RequirementActivityLink,
  RequirementRelationship,
  VerificationRecord,
} from '../types/project'
import { lookupByValue } from './defaults'

export interface RelationshipFlags {
  hasAny: boolean
  hasDerivedFromSource: boolean
  hasConflictOrDuplicate: boolean
  hasBroken: boolean
}

export interface ProjectIndexes {
  reqIds: Set<string>
  activityById: Map<string, ProjectData['testActivities'][number]>
  evidenceById: Map<string, ProjectData['evidence'][number]>
  sourceById: Map<string, ProjectData['sources'][number]>
  sourceLinksByReq: Map<string, ProjectData['requirementSourceLinks'][number][]>
  verificationsByReq: Map<string, VerificationRecord[]>
  linksByReq: Map<string, RequirementActivityLink[]>
  assessmentsByReq: Map<string, AssessmentRecord[]>
  currentAssessmentByReq: Map<string, AssessmentRecord | undefined>
  relationshipFlagsByReq: Map<string, RelationshipFlags>
  reqsWithMethod: Set<string>
  reqsWithActivity: Set<string>
  reqsWithEvidence: Set<string>
}

function emptyFlags(): RelationshipFlags {
  return {
    hasAny: false,
    hasDerivedFromSource: false,
    hasConflictOrDuplicate: false,
    hasBroken: false,
  }
}

function pushMap<T>(map: Map<string, T[]>, key: string, value: T) {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

export function buildProjectIndexes(project: ProjectData): ProjectIndexes {
  const reqIds = new Set(project.requirements.map((r) => r.id))
  const activityById = new Map(project.testActivities.map((t) => [t.id, t]))
  const evidenceById = new Map(project.evidence.map((e) => [e.id, e]))
  const sourceById = new Map((project.sources ?? []).map((source) => [source.id, source]))
  const sourceLinksByReq = new Map<string, ProjectData['requirementSourceLinks'][number][]>()
  for (const link of project.requirementSourceLinks ?? []) {
    pushMap(sourceLinksByReq, link.requirementId, link)
  }

  const verificationsByReq = new Map<string, VerificationRecord[]>()
  const reqsWithMethod = new Set<string>()
  const reqsWithEvidence = new Set<string>()

  for (const req of project.requirements) {
    if (req.evidenceIds.length > 0) reqsWithEvidence.add(req.id)
  }

  for (const v of project.verifications) {
    pushMap(verificationsByReq, v.requirementId, v)
    if (v.methodId) reqsWithMethod.add(v.requirementId)
    if (v.evidenceIds.length > 0) reqsWithEvidence.add(v.requirementId)
  }

  const linksByReq = new Map<string, RequirementActivityLink[]>()
  const reqsWithActivity = new Set<string>()
  for (const link of project.requirementActivityLinks) {
    pushMap(linksByReq, link.requirementId, link)
    reqsWithActivity.add(link.requirementId)
  }

  const assessmentsByReq = new Map<string, AssessmentRecord[]>()
  for (const a of project.assessments) {
    pushMap(assessmentsByReq, a.requirementId, a)
  }

  const currentAssessmentByReq = new Map<string, AssessmentRecord | undefined>()
  for (const [reqId, list] of assessmentsByReq) {
    const current = list.find((a) => a.isCurrent)
    if (current) {
      currentAssessmentByReq.set(reqId, current)
    } else {
      let best: AssessmentRecord | undefined
      for (const a of list) {
        if (!best || a.modifiedAt > best.modifiedAt) best = a
      }
      currentAssessmentByReq.set(reqId, best)
    }
  }

  const relationshipFlagsByReq = new Map<string, RelationshipFlags>()
  const ensure = (id: string) => {
    let flags = relationshipFlagsByReq.get(id)
    if (!flags) {
      flags = emptyFlags()
      relationshipFlagsByReq.set(id, flags)
    }
    return flags
  }

  for (const rel of project.relationships) {
    const broken = !reqIds.has(rel.sourceRequirementId) || !reqIds.has(rel.targetRequirementId)
    const sourceFlags = ensure(rel.sourceRequirementId)
    const targetFlags = ensure(rel.targetRequirementId)
    sourceFlags.hasAny = true
    targetFlags.hasAny = true
    if (broken) {
      sourceFlags.hasBroken = true
      targetFlags.hasBroken = true
    }
    if (rel.type === 'Derived from') {
      sourceFlags.hasDerivedFromSource = true
    }
    if (rel.type === 'Conflicts with' || rel.type === 'Duplicates') {
      sourceFlags.hasConflictOrDuplicate = true
      targetFlags.hasConflictOrDuplicate = true
    }
  }

  for (const link of project.requirementSourceLinks ?? []) {
    const flags = ensure(link.requirementId)
    flags.hasAny = true
    if (!reqIds.has(link.requirementId) || !sourceById.has(link.sourceId)) {
      flags.hasBroken = true
    }
    if (link.type === 'Derived from') {
      flags.hasDerivedFromSource = true
    }
  }

  return {
    reqIds,
    activityById,
    evidenceById,
    sourceById,
    sourceLinksByReq,
    verificationsByReq,
    linksByReq,
    assessmentsByReq,
    currentAssessmentByReq,
    relationshipFlagsByReq,
    reqsWithMethod,
    reqsWithActivity,
    reqsWithEvidence,
  }
}

export function currentAssessmentIndexed(
  indexes: ProjectIndexes,
  requirementId: string,
): AssessmentRecord | undefined {
  return indexes.currentAssessmentByReq.get(requirementId)
}

export function matchesGapIndexed(
  project: ProjectData,
  indexes: ProjectIndexes,
  req: Requirement,
  gapKey: string,
): boolean {
  const activeId = lookupByValue(project.lookups.statuses, 'Active')?.id
  const flags = indexes.relationshipFlagsByReq.get(req.id) ?? emptyFlags()

  switch (gapKey) {
    case 'derived-without-source':
      return req.isDerived && !flags.hasDerivedFromSource
    case 'no-relationships':
      return !flags.hasAny
    case 'active-no-activity':
      return req.statusId === activeId && !indexes.reqsWithActivity.has(req.id)
    case 'active-no-method':
      return req.statusId === activeId && !indexes.reqsWithMethod.has(req.id)
    case 'no-tags':
      return req.tagIds.length === 0
    case 'conflict-or-duplicate':
      return flags.hasConflictOrDuplicate
    case 'broken-references':
      return flags.hasBroken
    default:
      return true
  }
}

export function relationshipParticipates(
  rel: RequirementRelationship,
  requirementId: string,
): boolean {
  return rel.sourceRequirementId === requirementId || rel.targetRequirementId === requirementId
}
