import {
  FILE_FORMAT_ID,
  RELATIONSHIP_TYPES,
  SCHEMA_VERSION,
  type ProjectData,
  type Requirement,
  type RequirementRelationship,
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
function migrateProject(raw: ProjectData, issues: ValidationIssue[]): ProjectData {
  const project = raw
  if (project.schemaVersion < SCHEMA_VERSION) {
    issues.push({
      level: 'warning',
      message: `Migrated project from schema v${project.schemaVersion} to v${SCHEMA_VERSION}.`,
    })
    project.schemaVersion = SCHEMA_VERSION
    project.metadata.schemaVersion = SCHEMA_VERSION
  }
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
  project.relationships ??= []
  project.testActivities ??= []
  project.requirementActivityLinks ??= []
  project.evidence ??= []
  project.verifications ??= []
  project.assessments ??= []
  project.savedViews ??= []
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

  if (parsed.schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      issues: [
        {
          level: 'error',
          message: `Unsupported future schema version ${parsed.schemaVersion}. This application supports up to v${SCHEMA_VERSION}.`,
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

  const project = migrateProject(parsed as unknown as ProjectData, issues)
  const reqIds = new Set<string>()
  for (const req of project.requirements) {
    if (req?.id) reqIds.add(req.id)
  }
  const activityIds = new Set(project.testActivities.map((t) => t.id))
  const evidenceIds = new Set(project.evidence.map((e) => e.id))
  const tagIds = new Set(project.tags.map((t) => t.id))

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
