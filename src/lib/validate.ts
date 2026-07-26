import {
  FILE_FORMAT_ID,
  RELATIONSHIP_TYPES,
  SCHEMA_VERSION,
  type ProjectData,
  type Requirement,
  type RequirementRelationship,
} from '../types/project'
import { ensureLinkSafety } from './sanitize'

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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeProjectRichText(project: ProjectData): ProjectData {
  return {
    ...project,
    requirements: project.requirements.map((req) => ({
      ...req,
      requirementText: ensureLinkSafety(req.requirementText || ''),
      description: ensureLinkSafety(req.description || ''),
      analystNotes: ensureLinkSafety(req.analystNotes || ''),
      rationale: ensureLinkSafety(req.rationale || ''),
      verificationNotes: ensureLinkSafety(req.verificationNotes || ''),
    })),
    verifications: project.verifications.map((v) => ({
      ...v,
      notes: ensureLinkSafety(v.notes || ''),
      assessmentNarrative: ensureLinkSafety(v.assessmentNarrative || ''),
    })),
    assessments: project.assessments.map((a) => ({
      ...a,
      narrative: ensureLinkSafety(a.narrative || ''),
    })),
    testActivities: project.testActivities.map((t) => ({
      ...t,
      objectives: ensureLinkSafety(t.objectives || ''),
      notes: ensureLinkSafety(t.notes || ''),
      dataSources: ensureLinkSafety(t.dataSources || ''),
    })),
  }
}

function migrateProject(raw: ProjectData, issues: ValidationIssue[]): ProjectData {
  let project = structuredClone(raw)
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
  return sanitizeProjectRichText(project)
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
  const reqIds = new Set(project.requirements.map((r) => r.id))
  const activityIds = new Set(project.testActivities.map((t) => t.id))
  const evidenceIds = new Set(project.evidence.map((e) => e.id))
  const tagIds = new Set(project.tags.map((t) => t.id))

  for (const req of project.requirements) {
    if (!req.id || !req.sourceId?.trim() || !plainRequired(req.requirementText) || !req.statusId || !req.classificationId) {
      issues.push({
        level: 'error',
        message: `Requirement "${req.sourceId || req.id}" is missing required fields.`,
        path: `requirements.${req.id}`,
      })
    }
    for (const tagId of req.tagIds || []) {
      if (!tagIds.has(tagId)) {
        issues.push({
          level: 'warning',
          message: `Requirement ${req.sourceId} references missing tag ${tagId}.`,
        })
      }
    }
    for (const eid of req.evidenceIds || []) {
      if (!evidenceIds.has(eid)) {
        issues.push({
          level: 'warning',
          message: `Requirement ${req.sourceId} references missing evidence ${eid}.`,
        })
      }
    }
  }

  for (const rel of project.relationships) {
    if (!RELATIONSHIP_TYPES.includes(rel.type)) {
      issues.push({
        level: 'error',
        message: `Unsupported relationship type "${rel.type}".`,
        path: `relationships.${rel.id}`,
      })
    }
    if (rel.sourceRequirementId === rel.targetRequirementId) {
      issues.push({
        level: 'error',
        message: 'Self-referential relationship detected.',
        path: `relationships.${rel.id}`,
      })
    }
    if (!reqIds.has(rel.sourceRequirementId) || !reqIds.has(rel.targetRequirementId)) {
      issues.push({
        level: 'warning',
        message: `Broken relationship reference (${rel.type}).`,
        path: `relationships.${rel.id}`,
      })
    }
  }

  for (const link of project.requirementActivityLinks) {
    if (!reqIds.has(link.requirementId) || !activityIds.has(link.testActivityId)) {
      issues.push({
        level: 'warning',
        message: `Broken requirement–test activity link ${link.id}.`,
      })
    }
  }

  for (const v of project.verifications) {
    if (!reqIds.has(v.requirementId)) {
      issues.push({ level: 'warning', message: `Verification ${v.id} references missing requirement.` })
    }
  }

  for (const a of project.assessments) {
    if (!reqIds.has(a.requirementId)) {
      issues.push({ level: 'warning', message: `Assessment ${a.id} references missing requirement.` })
    }
    if (!a.resultId) {
      issues.push({ level: 'error', message: `Assessment ${a.id} is missing a result.` })
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
