import {
  FILE_FORMAT_ID,
  RELATIONSHIP_TYPES,
  SCHEMA_VERSION,
  SOURCE_RELATIONSHIP_TYPES,
  type ProjectData,
  type Requirement,
  type RequirementRelationship,
  WATCH_ITEM_STATUSES,
} from '../types/project'

export interface ValidationIssue {
  level: 'error' | 'warning'
  message: string
  path?: string
}

export interface LoadResult {
  ok: boolean
  project?: ProjectData
  issues: ValidationIssue[]
}

const MAX_WARNING_ISSUES = 40

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function pushIssue(issues: ValidationIssue[], issue: ValidationIssue, warningCount: { n: number }) {
  if (issue.level === 'warning') {
    if (warningCount.n >= MAX_WARNING_ISSUES) {
      if (warningCount.n === MAX_WARNING_ISSUES) {
        issues.push({
          level: 'warning',
          message: `Additional warnings omitted after ${MAX_WARNING_ISSUES} (file loaded with dangling references).`,
        })
        warningCount.n += 1
      }
      return
    }
    warningCount.n += 1
  }
  issues.push(issue)
}

/**
 * Normalize project shape after JSON parse.
 * Intentionally does NOT run per-field DOM sanitization here — that was freezing
 * large imports. Display/edit paths sanitize on render and save instead.
 */
function normalizeCurrentProject(raw: ProjectData): ProjectData {
  const project = raw
  project.lookups = {
    statuses: project.lookups?.statuses ?? [],
    types: project.lookups?.types ?? [],
    classifications: project.lookups?.classifications ?? [],
    priorities: project.lookups?.priorities ?? [],
    verificationMethods: project.lookups?.verificationMethods ?? [],
    verificationStatuses: project.lookups?.verificationStatuses ?? [],
    assessmentResults: project.lookups?.assessmentResults ?? [],
    testActivityTypes: project.lookups?.testActivityTypes ?? [],
    testPhases: project.lookups?.testPhases ?? [],
    testActivityStatuses: project.lookups?.testActivityStatuses ?? [],
    evidenceTypes: project.lookups?.evidenceTypes ?? [],
  }
  project.tagCategories ??= []
  project.tags ??= []
  project.requirements ??= []
  project.watchItems ??= []
  project.relationships ??= []
  project.sources ??= []
  project.requirementSourceLinks ??= []
  project.testActivities ??= []
  project.requirementActivityLinks ??= []
  project.evidence ??= []
  project.verifications ??= []
  project.assessments ??= []
  project.savedViews ??= []
  for (const req of project.requirements) {
    if (typeof req.sourceDocumentId !== 'string') {
      req.sourceDocumentId = ''
    }
  }
  return project
}

export function validateRequirementDraft(req: Partial<Requirement>): string[] {
  const errors: string[] = []
  if (!req.sourceId?.trim()) errors.push('Source requirement ID is required.')
  if (!plainRequired(req.requirementText)) errors.push('Requirement text is required.')
  if (!req.statusId) errors.push('Requirement status is required.')
  if (!req.classificationId) errors.push('Classification marking is required.')
  return errors
}

function plainRequired(html: string | undefined): boolean {
  if (!html) return false
  const text = html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
  return text.length > 0
}

export function parseAndValidateProject(rawText: string): LoadResult {
  const issues: ValidationIssue[] = []
  const warningCount = { n: 0 }
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    return { ok: false, issues: [{ level: 'error', message: 'File is not valid JSON.' }] }
  }

  if (!isObject(parsed)) {
    return { ok: false, issues: [{ level: 'error', message: 'Project root must be an object.' }] }
  }

  if (parsed.formatId !== FILE_FORMAT_ID) {
    return {
      ok: false,
      issues: [
        {
          level: 'error',
          message: `Unrecognized file format identifier. Expected "${FILE_FORMAT_ID}".`,
        },
      ],
    }
  }

  if (typeof parsed.schemaVersion !== 'number') {
    return {
      ok: false,
      issues: [{ level: 'error', message: 'Missing or invalid schema version.' }],
    }
  }

  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      issues: [
        {
          level: 'error',
          message: `Unsupported schema version ${parsed.schemaVersion}. Expected v${SCHEMA_VERSION}.`,
        },
      ],
    }
  }

  if (!isObject(parsed.metadata) || typeof parsed.metadata.id !== 'string') {
    return {
      ok: false,
      issues: [{ level: 'error', message: 'Project metadata is missing or invalid.' }],
    }
  }

  if (!Array.isArray(parsed.watchItems)) {
    return {
      ok: false,
      issues: [
        {
          level: 'error',
          message: 'Project is missing the current watchItems collection.',
          path: 'watchItems',
        },
      ],
    }
  }

  const project = normalizeCurrentProject(parsed as unknown as ProjectData)
  const reqIds = new Set<string>()
  for (const req of project.requirements) {
    if (req?.id) reqIds.add(req.id)
  }
  const activityIds = new Set(project.testActivities.map((t) => t.id))
  const evidenceIds = new Set(project.evidence.map((e) => e.id))
  const tagIds = new Set(project.tags.map((t) => t.id))
  const sourceIds = new Set(project.sources.map((source) => source.id))

  for (const req of project.requirements) {
    if (!req.id || !req.sourceId?.trim() || !plainRequired(req.requirementText) || !req.statusId || !req.classificationId) {
      pushIssue(
        issues,
        {
          level: 'error',
          message: `Requirement "${req.sourceId || req.id}" is missing required fields.`,
          path: `requirements.${req.id}`,
        },
        warningCount,
      )
    }
    if (req.sourceDocumentId && !sourceIds.has(req.sourceDocumentId)) {
      pushIssue(
        issues,
        {
          level: 'warning',
          message: `Requirement ${req.sourceId} references missing source document ${req.sourceDocumentId}.`,
          path: `requirements.${req.id}.sourceDocumentId`,
        },
        warningCount,
      )
    }
  }

  for (const [index, watchItem] of project.watchItems.entries()) {
    if (!isObject(watchItem)) {
      pushIssue(
        issues,
        {
          level: 'error',
          message: `Watch item at index ${index} must be an object.`,
          path: `watchItems.${index}`,
        },
        warningCount,
      )
      continue
    }

    const label =
      typeof watchItem.title === 'string' && watchItem.title
        ? watchItem.title
        : typeof watchItem.id === 'string' && watchItem.id
          ? watchItem.id
          : `entry ${index + 1}`
    if (
      typeof watchItem.id !== 'string' ||
      !watchItem.id ||
      typeof watchItem.title !== 'string' ||
      !watchItem.title.trim() ||
      typeof watchItem.description !== 'string' ||
      !WATCH_ITEM_STATUSES.some((status) => status === watchItem.status) ||
      !Array.isArray(watchItem.observations) ||
      watchItem.observations.length === 0 ||
      watchItem.observations.some(
        (observation) =>
          !isObject(observation) ||
          typeof observation.id !== 'string' ||
          !observation.id ||
          typeof observation.text !== 'string' ||
          !plainRequired(observation.text) ||
          typeof observation.createdAt !== 'string' ||
          !observation.createdAt ||
          typeof observation.modifiedAt !== 'string' ||
          !observation.modifiedAt ||
          typeof observation.editorName !== 'string',
      ) ||
      !Array.isArray(watchItem.requirementIds) ||
      !Array.isArray(watchItem.sourceIds) ||
      typeof watchItem.createdAt !== 'string' ||
      !watchItem.createdAt ||
      typeof watchItem.modifiedAt !== 'string' ||
      !watchItem.modifiedAt ||
      typeof watchItem.editorName !== 'string'
    ) {
      pushIssue(
        issues,
        {
          level: 'error',
          message: `Watch item "${label}" is missing required fields.`,
          path: typeof watchItem.id === 'string' && watchItem.id
            ? `watchItems.${watchItem.id}`
            : `watchItems.${index}`,
        },
        warningCount,
      )
      continue
    }

    for (const requirementId of watchItem.requirementIds) {
      if (!reqIds.has(requirementId)) {
        pushIssue(
          issues,
          {
            level: 'warning',
            message: `Watch item "${watchItem.title}" references missing requirement ${requirementId}.`,
          },
          warningCount,
        )
      }
    }
    for (const sourceId of watchItem.sourceIds) {
      if (!sourceIds.has(sourceId)) {
        pushIssue(
          issues,
          {
            level: 'warning',
            message: `Watch item "${watchItem.title}" references missing source ${sourceId}.`,
          },
          warningCount,
        )
      }
    }
  }

  for (const req of project.requirements) {
    for (const tagId of req.tagIds || []) {
      if (!tagIds.has(tagId)) {
        pushIssue(
          issues,
          {
            level: 'warning',
            message: `Requirement ${req.sourceId} references missing tag ${tagId}.`,
          },
          warningCount,
        )
      }
    }
    for (const eid of req.evidenceIds || []) {
      if (!evidenceIds.has(eid)) {
        pushIssue(
          issues,
          {
            level: 'warning',
            message: `Requirement ${req.sourceId} references missing evidence ${eid}.`,
          },
          warningCount,
        )
      }
    }
  }

  for (const rel of project.relationships) {
    if (!RELATIONSHIP_TYPES.includes(rel.type)) {
      pushIssue(
        issues,
        {
          level: 'error',
          message: `Unsupported relationship type "${rel.type}".`,
          path: `relationships.${rel.id}`,
        },
        warningCount,
      )
    }
    if (rel.sourceRequirementId === rel.targetRequirementId) {
      pushIssue(
        issues,
        {
          level: 'error',
          message: 'Self-referential relationship detected.',
          path: `relationships.${rel.id}`,
        },
        warningCount,
      )
    }
    if (!reqIds.has(rel.sourceRequirementId) || !reqIds.has(rel.targetRequirementId)) {
      pushIssue(
        issues,
        {
          level: 'warning',
          message: `Broken relationship reference (${rel.type}).`,
          path: `relationships.${rel.id}`,
        },
        warningCount,
      )
    }
  }

  for (const source of project.sources) {
    if (!source.id || !source.title?.trim()) {
      pushIssue(
        issues,
        {
          level: 'error',
          message: `Source "${source.identifier || source.id || 'unknown'}" is missing required fields.`,
          path: `sources.${source.id || 'unknown'}`,
        },
        warningCount,
      )
    }
  }

  for (const link of project.requirementSourceLinks) {
    if (!SOURCE_RELATIONSHIP_TYPES.includes(link.type)) {
      pushIssue(
        issues,
        {
          level: 'error',
          message: `Unsupported requirement–source relationship type "${link.type}".`,
          path: `requirementSourceLinks.${link.id}`,
        },
        warningCount,
      )
    }
    if (!reqIds.has(link.requirementId) || !sourceIds.has(link.sourceId)) {
      pushIssue(
        issues,
        {
          level: 'warning',
          message: `Broken requirement–source link ${link.id}.`,
          path: `requirementSourceLinks.${link.id}`,
        },
        warningCount,
      )
    }
  }

  for (const link of project.requirementActivityLinks) {
    if (!reqIds.has(link.requirementId) || !activityIds.has(link.testActivityId)) {
      pushIssue(
        issues,
        {
          level: 'warning',
          message: `Broken requirement–test activity link ${link.id}.`,
        },
        warningCount,
      )
    }
  }

  for (const v of project.verifications) {
    if (!reqIds.has(v.requirementId)) {
      pushIssue(
        issues,
        { level: 'warning', message: `Verification ${v.id} references missing requirement.` },
        warningCount,
      )
    }
  }

  for (const a of project.assessments) {
    if (!reqIds.has(a.requirementId)) {
      pushIssue(
        issues,
        { level: 'warning', message: `Assessment ${a.id} references missing requirement.` },
        warningCount,
      )
    }
    if (!a.resultId) {
      pushIssue(
        issues,
        { level: 'error', message: `Assessment ${a.id} is missing a result.` },
        warningCount,
      )
    }
  }

  const hasErrors = issues.some((i) => i.level === 'error')
  if (hasErrors) {
    return { ok: false, issues }
  }

  return { ok: true, project, issues }
}

export function findDuplicateRelationship(
  relationships: RequirementRelationship[],
  sourceId: string,
  targetId: string,
  type: string,
  excludeId?: string,
): RequirementRelationship | undefined {
  return relationships.find(
    (r) =>
      r.id !== excludeId &&
      r.sourceRequirementId === sourceId &&
      r.targetRequirementId === targetId &&
      r.type === type,
  )
}
