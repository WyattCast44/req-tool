import type {
  ProjectData,
  Requirement,
  RequirementFilters,
  SortSpec,
  TagLogic,
} from '../types/project'
import { lookupByValue, lookupLabel } from './defaults'
import {
  buildProjectIndexes,
  currentAssessmentIndexed,
  matchesGapIndexed,
  type ProjectIndexes,
} from './projectIndexes'

/** Fast HTML → plain text for search (no DOMParser). */
export function cheapPlainText(html: string | undefined): string {
  if (!html) return ''
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

export function currentAssessment(project: ProjectData, requirementId: string, indexes?: ProjectIndexes) {
  if (indexes) return currentAssessmentIndexed(indexes, requirementId)
  const current = project.assessments.find((a) => a.requirementId === requirementId && a.isCurrent)
  if (current) return current
  let best = undefined as (typeof project.assessments)[number] | undefined
  for (const a of project.assessments) {
    if (a.requirementId !== requirementId) continue
    if (!best || a.modifiedAt > best.modifiedAt) best = a
  }
  return best
}

export function requirementSearchText(project: ProjectData, req: Requirement, indexes?: ProjectIndexes): string {
  const evidenceText = req.evidenceIds
    .map((id) => {
      const e = indexes ? indexes.evidenceById.get(id) : project.evidence.find((x) => x.id === id)
      return e ? `${e.title} ${e.fileName} ${e.filePath} ${e.notes}` : ''
    })
    .join(' ')
  const sourceText = (indexes?.sourceLinksByReq.get(req.id) ||
    (project.requirementSourceLinks ?? []).filter((link) => link.requirementId === req.id))
    .map((link) => {
      const source = indexes
        ? indexes.sourceById.get(link.sourceId)
        : (project.sources ?? []).find((item) => item.id === link.sourceId)
      return source
        ? `${source.identifier} ${source.title} ${source.sourceType} ${source.version} ${source.publisher} ${link.type} ${link.locator} ${cheapPlainText(link.rationale)} ${cheapPlainText(link.notes)}`
        : ''
    })
    .join(' ')
  return [
    req.sourceId,
    req.shortTitle,
    cheapPlainText(req.requirementText),
    cheapPlainText(req.description),
    cheapPlainText(req.analystNotes),
    cheapPlainText(req.rationale),
    req.editorName,
    req.changeSummary,
    sourceText,
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

export function matchesGap(project: ProjectData, req: Requirement, gapKey: string, indexes?: ProjectIndexes): boolean {
  const idx = indexes ?? buildProjectIndexes(project)
  return matchesGapIndexed(project, idx, req, gapKey)
}

export function matchesFilters(
  project: ProjectData,
  req: Requirement,
  searchQuery: string,
  filters: RequirementFilters,
  tagLogic: TagLogic,
  indexes?: ProjectIndexes,
): boolean {
  const idx = indexes ?? buildProjectIndexes(project)

  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase()
    if (!requirementSearchText(project, req, idx).includes(q)) return false
  }

  if (filters.statusIds.length && !filters.statusIds.includes(req.statusId)) return false
  if (filters.classificationIds.length && !filters.classificationIds.includes(req.classificationId))
    return false
  if (filters.typeIds.length && !filters.typeIds.includes(req.typeId)) return false
  if (filters.priorityIds.length && !filters.priorityIds.includes(req.priorityId)) return false
  if (filters.sourceIds.length) {
    const linkedSourceIds = (idx.sourceLinksByReq.get(req.id) || []).map((link) => link.sourceId)
    if (!filters.sourceIds.some((id) => linkedSourceIds.includes(id))) return false
  }
  if (filters.verificationMethodIds.length) {
    const methods = (idx.verificationsByReq.get(req.id) || []).map((v) => v.methodId)
    if (!filters.verificationMethodIds.some((id) => methods.includes(id))) return false
  }

  if (filters.assessmentResultIds.length) {
    const assessment = currentAssessmentIndexed(idx, req.id)
    if (!assessment || !filters.assessmentResultIds.includes(assessment.resultId)) return false
  }

  if (filters.testActivityIds.length) {
    const linked = (idx.linksByReq.get(req.id) || []).map((l) => l.testActivityId)
    if (!filters.testActivityIds.some((id) => linked.includes(id))) return false
  }

  if (filters.testPhaseIds.length) {
    const phases = (idx.linksByReq.get(req.id) || [])
      .map((l) => idx.activityById.get(l.testActivityId)?.phaseId)
      .filter(Boolean) as string[]
    if (!filters.testPhaseIds.some((id) => phases.includes(id))) return false
  }

  if (filters.owners.length) {
    const owners = (idx.linksByReq.get(req.id) || [])
      .map((l) => idx.activityById.get(l.testActivityId)?.owner || '')
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
    if (!matchesGapIndexed(project, idx, req, filters.gapKey)) return false
  }

  return true
}

export function filterRequirements(
  project: ProjectData,
  searchQuery: string,
  filters: RequirementFilters,
  tagLogic: TagLogic,
  sort: SortSpec[],
): Requirement[] {
  const indexes = buildProjectIndexes(project)
  const filtered = project.requirements.filter((req) =>
    matchesFilters(project, req, searchQuery, filters, tagLogic, indexes),
  )
  return sortRequirements(project, filtered, sort, indexes)
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
  indexes?: ProjectIndexes,
): Requirement[] {
  const specs = sort.length ? sort : [{ field: 'sourceId', direction: 'asc' as const }]
  const idx = indexes ?? buildProjectIndexes(project)
  return [...requirements].sort((a, b) => {
    for (const spec of specs) {
      const av = sortValue(project, a, spec.field, idx)
      const bv = sortValue(project, b, spec.field, idx)
      const cmp = compareValues(av, bv, spec.direction)
      if (cmp !== 0) return cmp
    }
    return 0
  })
}

function sortValue(
  project: ProjectData,
  req: Requirement,
  field: string,
  indexes: ProjectIndexes,
): string {
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
      const a = currentAssessmentIndexed(indexes, req.id)
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
  const indexes = buildProjectIndexes(project)
  const statusCountMap = new Map<string, number>()
  for (const s of project.lookups.statuses) statusCountMap.set(s.id, 0)

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

  const gapCounts: Record<string, number> = {
    'derived-without-source': 0,
    'no-relationships': 0,
    'active-no-activity': 0,
    'active-no-method': 0,
    'no-tags': 0,
    'conflict-or-duplicate': 0,
    'broken-references': 0,
  }

  let recentChanges = project.requirements.slice(0, 10)
  if (project.requirements.length > 10) {
    // Partial top-N without full sort of 900 when possible: sort copy once.
    recentChanges = [...project.requirements]
      .sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : a.modifiedAt > b.modifiedAt ? -1 : 0))
      .slice(0, 10)
  } else {
    recentChanges = [...project.requirements].sort((a, b) =>
      a.modifiedAt < b.modifiedAt ? 1 : a.modifiedAt > b.modifiedAt ? -1 : 0,
    )
  }

  for (const req of project.requirements) {
    statusCountMap.set(req.statusId, (statusCountMap.get(req.statusId) || 0) + 1)

    if (indexes.reqsWithMethod.has(req.id)) withMethod += 1
    if (indexes.reqsWithActivity.has(req.id)) withActivity += 1
    if (indexes.reqsWithEvidence.has(req.id)) withEvidence += 1

    const assessment = currentAssessmentIndexed(indexes, req.id)
    if (!assessment || assessment.resultId === notYetId) {
      notYetAssessed += 1
    } else {
      assessed += 1
      if (assessment.resultId === metId) met += 1
      else if (assessment.resultId === partialId) partiallyMet += 1
      else if (assessment.resultId === notMetId) notMet += 1
      else if (assessment.resultId === inconclusiveId) inconclusive += 1
    }

    for (const key of Object.keys(gapCounts)) {
      if (matchesGapIndexed(project, indexes, req, key)) gapCounts[key] += 1
    }
  }

  const statusCounts = project.lookups.statuses
    .filter((s) => s.active)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({
      id: s.id,
      label: s.value,
      count: statusCountMap.get(s.id) || 0,
    }))

  const gapDefs = [
    { key: 'derived-without-source', label: 'Derived without source relationship' },
    { key: 'no-relationships', label: 'No relationships' },
    { key: 'active-no-activity', label: 'Active with no planned test activity' },
    { key: 'active-no-method', label: 'Active with no verification method' },
    { key: 'no-tags', label: 'No tags' },
    { key: 'conflict-or-duplicate', label: 'Conflicts or duplicates' },
    { key: 'broken-references', label: 'Broken references' },
  ]

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
    gaps: gapDefs.map((g) => ({ ...g, count: gapCounts[g.key] || 0 })),
  }
}
