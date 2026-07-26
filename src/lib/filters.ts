import type {
  ProjectData,
  Requirement,
  RequirementFilters,
  SortSpec,
  TagLogic,
} from '../types/project'
import { plainTextFromHtml } from './sanitize'
import { lookupByValue, lookupLabel } from './defaults'

export function currentAssessment(project: ProjectData, requirementId: string) {
  const current = project.assessments.find((a) => a.requirementId === requirementId && a.isCurrent)
  if (current) return current
  return project.assessments
    .filter((a) => a.requirementId === requirementId)
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))[0]
}

export function requirementSearchText(project: ProjectData, req: Requirement): string {
  const evidenceText = req.evidenceIds
    .map((id) => {
      const e = project.evidence.find((x) => x.id === id)
      return e ? `${e.title} ${e.fileName} ${e.filePath} ${e.notes}` : ''
    })
    .join(' ')
  return [
    req.sourceId,
    req.shortTitle,
    plainTextFromHtml(req.requirementText),
    plainTextFromHtml(req.description),
    plainTextFromHtml(req.analystNotes),
    plainTextFromHtml(req.rationale),
    req.sourceDocument,
    req.sourceSection,
    evidenceText,
  ]
    .join(' ')
    .toLowerCase()
}

function inDateRange(value: string, from: string, to: string): boolean {
  if (!from && !to) return true
  const t = new Date(value).getTime()
  if (Number.isNaN(t)) return false
  if (from && t < new Date(from).getTime()) return false
  if (to) {
    const end = new Date(to)
    end.setHours(23, 59, 59, 999)
    if (t > end.getTime()) return false
  }
  return true
}

export function matchesFilters(
  project: ProjectData,
  req: Requirement,
  searchQuery: string,
  filters: RequirementFilters,
  tagLogic: TagLogic,
): boolean {
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase()
    if (!requirementSearchText(project, req).includes(q)) return false
  }

  if (filters.statusIds.length && !filters.statusIds.includes(req.statusId)) return false
  if (filters.classificationIds.length && !filters.classificationIds.includes(req.classificationId))
    return false
  if (filters.typeIds.length && !filters.typeIds.includes(req.typeId)) return false
  if (filters.priorityIds.length && !filters.priorityIds.includes(req.priorityId)) return false
  if (filters.sourceDocuments.length && !filters.sourceDocuments.includes(req.sourceDocument))
    return false

  if (filters.verificationMethodIds.length) {
    const methods = project.verifications
      .filter((v) => v.requirementId === req.id)
      .map((v) => v.methodId)
    if (!filters.verificationMethodIds.some((id) => methods.includes(id))) return false
  }

  if (filters.assessmentResultIds.length) {
    const assessment = currentAssessment(project, req.id)
    if (!assessment || !filters.assessmentResultIds.includes(assessment.resultId)) return false
  }

  if (filters.testActivityIds.length) {
    const linked = project.requirementActivityLinks
      .filter((l) => l.requirementId === req.id)
      .map((l) => l.testActivityId)
    if (!filters.testActivityIds.some((id) => linked.includes(id))) return false
  }

  if (filters.testPhaseIds.length) {
    const phases = project.requirementActivityLinks
      .filter((l) => l.requirementId === req.id)
      .map((l) => project.testActivities.find((t) => t.id === l.testActivityId)?.phaseId)
      .filter(Boolean) as string[]
    if (!filters.testPhaseIds.some((id) => phases.includes(id))) return false
  }

  if (filters.owners.length) {
    const owners = project.requirementActivityLinks
      .filter((l) => l.requirementId === req.id)
      .map((l) => project.testActivities.find((t) => t.id === l.testActivityId)?.owner || '')
      .filter(Boolean)
    if (!filters.owners.some((o) => owners.includes(o))) return false
  }

  if (filters.tagIds.length) {
    const tags = new Set(req.tagIds)
    if (tagLogic === 'all') {
      if (!filters.tagIds.every((id) => tags.has(id))) return false
    } else if (tagLogic === 'exclude') {
      if (filters.tagIds.some((id) => tags.has(id))) return false
    } else if (!filters.tagIds.some((id) => tags.has(id))) {
      return false
    }
  }

  if (!inDateRange(req.createdAt, filters.createdFrom, filters.createdTo)) return false
  if (!inDateRange(req.modifiedAt, filters.modifiedFrom, filters.modifiedTo)) return false

  if (filters.gapKey) {
    if (!matchesGap(project, req, filters.gapKey)) return false
  }

  return true
}

export function matchesGap(project: ProjectData, req: Requirement, gapKey: string): boolean {
  const activeId = lookupByValue(project.lookups.statuses, 'Active')?.id
  const derivedFrom = project.relationships.some(
    (r) => r.targetRequirementId === req.id && r.type === 'Derived from',
  )
  const hasRelationships = project.relationships.some(
    (r) => r.sourceRequirementId === req.id || r.targetRequirementId === req.id,
  )
  const hasActivity = project.requirementActivityLinks.some((l) => l.requirementId === req.id)
  const hasMethod = project.verifications.some((v) => v.requirementId === req.id && v.methodId)
  const conflicting = project.relationships.some(
    (r) =>
      (r.sourceRequirementId === req.id || r.targetRequirementId === req.id) &&
      (r.type === 'Conflicts with' || r.type === 'Duplicates'),
  )
  const broken = project.relationships.some((r) => {
    const ids = new Set(project.requirements.map((x) => x.id))
    return (
      (r.sourceRequirementId === req.id || r.targetRequirementId === req.id) &&
      (!ids.has(r.sourceRequirementId) || !ids.has(r.targetRequirementId))
    )
  })

  switch (gapKey) {
    case 'derived-without-source':
      return req.isDerived && !derivedFrom
    case 'no-relationships':
      return !hasRelationships
    case 'active-no-activity':
      return req.statusId === activeId && !hasActivity
    case 'active-no-method':
      return req.statusId === activeId && !hasMethod
    case 'no-tags':
      return req.tagIds.length === 0
    case 'conflict-or-duplicate':
      return conflicting
    case 'broken-references':
      return broken
    default:
      return true
  }
}

export function filterRequirements(
  project: ProjectData,
  searchQuery: string,
  filters: RequirementFilters,
  tagLogic: TagLogic,
  sort: SortSpec[],
): Requirement[] {
  const filtered = project.requirements.filter((req) =>
    matchesFilters(project, req, searchQuery, filters, tagLogic),
  )
  return sortRequirements(project, filtered, sort)
}

function compareValues(a: string | number, b: string | number, direction: 'asc' | 'desc'): number {
  if (a < b) return direction === 'asc' ? -1 : 1
  if (a > b) return direction === 'asc' ? 1 : -1
  return 0
}

export function sortRequirements(
  project: ProjectData,
  requirements: Requirement[],
  sort: SortSpec[],
): Requirement[] {
  const specs = sort.length ? sort : [{ field: 'sourceId', direction: 'asc' as const }]
  return [...requirements].sort((a, b) => {
    for (const spec of specs) {
      const av = sortValue(project, a, spec.field)
      const bv = sortValue(project, b, spec.field)
      const cmp = compareValues(av, bv, spec.direction)
      if (cmp !== 0) return cmp
    }
    return 0
  })
}

function sortValue(project: ProjectData, req: Requirement, field: string): string {
  switch (field) {
    case 'sourceId':
      return req.sourceId.toLowerCase()
    case 'shortTitle':
      return req.shortTitle.toLowerCase()
    case 'status':
      return lookupLabel(project.lookups.statuses, req.statusId).toLowerCase()
    case 'classification':
      return lookupLabel(project.lookups.classifications, req.classificationId).toLowerCase()
    case 'type':
      return lookupLabel(project.lookups.types, req.typeId).toLowerCase()
    case 'priority':
      return lookupLabel(project.lookups.priorities, req.priorityId).toLowerCase()
    case 'assessment': {
      const a = currentAssessment(project, req.id)
      return a ? lookupLabel(project.lookups.assessmentResults, a.resultId).toLowerCase() : ''
    }
    case 'modifiedAt':
      return req.modifiedAt
    case 'createdAt':
      return req.createdAt
    case 'editorName':
      return req.editorName.toLowerCase()
    default:
      return req.sourceId.toLowerCase()
  }
}

export interface DashboardStats {
  statusCounts: { id: string; label: string; count: number }[]
  verification: {
    withMethod: number
    withActivity: number
    withEvidence: number
    assessed: number
    notYetAssessed: number
    met: number
    partiallyMet: number
    notMet: number
    inconclusive: number
  }
  recentChanges: Requirement[]
  gaps: { key: string; label: string; count: number }[]
}

export function buildDashboardStats(project: ProjectData): DashboardStats {
  const total = project.requirements.length
  const statusCounts = project.lookups.statuses
    .filter((s) => s.active)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({
      id: s.id,
      label: s.value,
      count: project.requirements.filter((r) => r.statusId === s.id).length,
    }))

  const notYetId = lookupByValue(project.lookups.assessmentResults, 'Not Yet Assessed')?.id
  const metId = lookupByValue(project.lookups.assessmentResults, 'Met')?.id
  const partialId = lookupByValue(project.lookups.assessmentResults, 'Partially Met')?.id
  const notMetId = lookupByValue(project.lookups.assessmentResults, 'Not Met')?.id
  const inconclusiveId = lookupByValue(project.lookups.assessmentResults, 'Inconclusive')?.id

  let withMethod = 0
  let withActivity = 0
  let withEvidence = 0
  let assessed = 0
  let notYetAssessed = 0
  let met = 0
  let partiallyMet = 0
  let notMet = 0
  let inconclusive = 0

  for (const req of project.requirements) {
    if (project.verifications.some((v) => v.requirementId === req.id && v.methodId)) withMethod += 1
    if (project.requirementActivityLinks.some((l) => l.requirementId === req.id)) withActivity += 1
    if (req.evidenceIds.length > 0 || project.verifications.some((v) => v.requirementId === req.id && v.evidenceIds.length))
      withEvidence += 1
    const assessment = currentAssessment(project, req.id)
    if (!assessment || assessment.resultId === notYetId) {
      notYetAssessed += 1
    } else {
      assessed += 1
      if (assessment.resultId === metId) met += 1
      if (assessment.resultId === partialId) partiallyMet += 1
      if (assessment.resultId === notMetId) notMet += 1
      if (assessment.resultId === inconclusiveId) inconclusive += 1
    }
  }

  const gapDefs = [
    { key: 'derived-without-source', label: 'Derived without source relationship' },
    { key: 'no-relationships', label: 'No relationships' },
    { key: 'active-no-activity', label: 'Active with no planned test activity' },
    { key: 'active-no-method', label: 'Active with no verification method' },
    { key: 'no-tags', label: 'No tags' },
    { key: 'conflict-or-duplicate', label: 'Conflicts or duplicates' },
    { key: 'broken-references', label: 'Broken references' },
  ]

  const gaps = gapDefs.map((g) => ({
    ...g,
    count: project.requirements.filter((r) => matchesGap(project, r, g.key)).length,
  }))

  const recentChanges = [...project.requirements]
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
    .slice(0, 10)

  void total
  return {
    statusCounts,
    verification: {
      withMethod,
      withActivity,
      withEvidence,
      assessed,
      notYetAssessed,
      met,
      partiallyMet,
      notMet,
      inconclusive,
    },
    recentChanges,
    gaps,
  }
}
