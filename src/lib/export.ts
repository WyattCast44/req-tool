import {
  APP_VERSION,
  FILE_EXTENSION,
  type ProjectData,
  type Requirement,
  type RequirementRelationship,
} from '../types/project'
import { lookupLabel } from './defaults'
import { formatDate, nowIso, slugifyFilename } from './ids'
import { plainTextFromHtml } from './sanitize'

export function prepareExportProject(project: ProjectData, editorName: string): ProjectData {
  const exported: ProjectData = structuredClone(project)
  exported.applicationVersion = APP_VERSION
  exported.schemaVersion = project.schemaVersion
  exported.metadata.applicationVersion = APP_VERSION
  exported.metadata.schemaVersion = project.schemaVersion
  exported.metadata.exportSequence = (exported.metadata.exportSequence || 0) + 1
  exported.metadata.lastExportedAt = nowIso()
  exported.metadata.lastExportEditor = editorName || exported.metadata.editorNameDefault || ''
  exported.metadata.modifiedAt = exported.metadata.lastExportedAt
  return exported
}

export function exportFilename(project: ProjectData): string {
  const seq = String(project.metadata.exportSequence).padStart(3, '0')
  const date = (project.metadata.lastExportedAt || nowIso()).slice(0, 10)
  return `${slugifyFilename(project.metadata.name)}_Requirements_v${seq}_${date}${FILE_EXTENSION}`
}

export function downloadTextFile(filename: string, content: string, mime = 'application/json'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  downloadBlobFile(filename, blob)
}

export function downloadBlobFile(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function csvEscape(value: string): string {
  const needsQuotes = /[",\n\r]/.test(value)
  const escaped = value.replace(/"/g, '""')
  return needsQuotes ? `"${escaped}"` : escaped
}

export function requirementsToCsv(
  project: ProjectData,
  requirements: Requirement[],
): string {
  const headers = [
    'Source ID',
    'Source Document',
    'Short Title',
    'Requirement Text',
    'Status',
    'Classification',
    'Type',
    'Priority',
    'Linked Sources',
    'Source Relationships',
    'Tags',
    'Is Derived',
    'Linked Watch Items',
    'Verification Methods',
    'Test Activities',
    'Current Assessment',
    'Evidence Paths',
    'Editor',
    'Change Summary',
    'Created',
    'Modified',
    'UUID',
  ]

  const rows = requirements.map((req) => {
    const tagNames = req.tagIds
      .map((id) => project.tags.find((t) => t.id === id)?.name)
      .filter(Boolean)
      .join('|')
    const methods = project.verifications
      .filter((v) => v.requirementId === req.id)
      .map((v) => lookupLabel(project.lookups.verificationMethods, v.methodId))
      .filter((v) => v !== '—')
      .join('|')
    const activities = project.requirementActivityLinks
      .filter((l) => l.requirementId === req.id)
      .map((l) => project.testActivities.find((t) => t.id === l.testActivityId)?.title)
      .filter(Boolean)
      .join('|')
    const assessment =
      project.assessments.find((a) => a.requirementId === req.id && a.isCurrent) ||
      project.assessments
        .filter((a) => a.requirementId === req.id)
        .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))[0]
    const evidence = req.evidenceIds
      .map((id) => project.evidence.find((e) => e.id === id)?.filePath)
      .filter(Boolean)
      .join('|')
    const ownedSource = req.sourceDocumentId
      ? (project.sources ?? []).find((item) => item.id === req.sourceDocumentId)
      : undefined
    const sourceLinks = (project.requirementSourceLinks ?? []).filter(
      (link) => link.requirementId === req.id,
    )
    const linkedSources = [
      ...(ownedSource ? [ownedSource.identifier || ownedSource.title] : []),
      ...sourceLinks
        .map((link) => {
          const source = (project.sources ?? []).find((item) => item.id === link.sourceId)
          return source ? source.identifier || source.title : undefined
        })
        .filter(
          (label): label is string =>
            Boolean(label) && label !== (ownedSource?.identifier || ownedSource?.title),
        ),
    ].join('|')
    const sourceRelationships = sourceLinks
      .map((link) => {
        const source = (project.sources ?? []).find((item) => item.id === link.sourceId)
        const label = source?.identifier || source?.title || link.sourceId
        return `${link.type}: ${label}${link.locator ? ` (${link.locator})` : ''}`
      })
      .join('|')

    return [
      req.sourceId,
      ownedSource ? ownedSource.identifier || ownedSource.title : '',
      req.shortTitle,
      plainTextFromHtml(req.requirementText),
      lookupLabel(project.lookups.statuses, req.statusId),
      lookupLabel(project.lookups.classifications, req.classificationId),
      lookupLabel(project.lookups.types, req.typeId),
      lookupLabel(project.lookups.priorities, req.priorityId),
      linkedSources,
      sourceRelationships,
      tagNames,
      req.isDerived ? 'Yes' : 'No',
      project.watchItems
        .filter((watchItem) => watchItem.requirementIds.includes(req.id))
        .map((watchItem) => watchItem.title)
        .join('|'),
      methods,
      activities,
      assessment ? lookupLabel(project.lookups.assessmentResults, assessment.resultId) : '',
      evidence,
      req.editorName,
      req.changeSummary,
      formatDate(req.createdAt),
      formatDate(req.modifiedAt),
      req.id,
    ].map((v) => csvEscape(String(v ?? '')))
  })

  return [headers.map(csvEscape).join(','), ...rows.map((r) => r.join(','))].join('\r\n')
}

export function matrixToCsv(
  project: ProjectData,
  relationships: RequirementRelationship[],
): string {
  const headers = [
    'Source ID',
    'Source Title',
    'Target ID',
    'Target Title',
    'Relationship Type',
    'Direction',
    'Rationale',
    'Notes',
  ]
  const reqMap = new Map(project.requirements.map((r) => [r.id, r]))
  const rows = relationships.map((rel) => {
    const source = reqMap.get(rel.sourceRequirementId)
    const target = reqMap.get(rel.targetRequirementId)
    return [
      source?.sourceId ?? '',
      source?.shortTitle ?? '',
      target?.sourceId ?? '',
      target?.shortTitle ?? '',
      rel.type,
      'source → target',
      rel.rationale,
      rel.notes,
    ].map((v) => csvEscape(String(v ?? '')))
  })
  return [headers.map(csvEscape).join(','), ...rows.map((r) => r.join(','))].join('\r\n')
}

export function watchItemsToCsv(project: ProjectData): string {
  const headers = [
    'Title',
    'Status',
    'Description',
    'Observations',
    'Requirements',
    'Sources',
    'Editor',
    'Created',
    'Modified',
    'UUID',
  ]
  const rows = project.watchItems.map((watchItem) => [
    watchItem.title,
    watchItem.status,
    plainTextFromHtml(watchItem.description),
    watchItem.observations
      .map(
        (observation) =>
          `${formatDate(observation.createdAt)} — ${observation.editorName || 'Unknown'}: ${plainTextFromHtml(observation.text)}`,
      )
      .join(' | '),
    watchItem.requirementIds
      .map((id) => project.requirements.find((requirement) => requirement.id === id)?.sourceId)
      .filter(Boolean)
      .join('|'),
    watchItem.sourceIds
      .map((id) => {
        const source = project.sources.find((item) => item.id === id)
        return source?.identifier || source?.title
      })
      .filter(Boolean)
      .join('|'),
    watchItem.editorName,
    formatDate(watchItem.createdAt),
    formatDate(watchItem.modifiedAt),
    watchItem.id,
  ].map((value) => csvEscape(String(value ?? ''))))

  return [headers.map(csvEscape).join(','), ...rows.map((row) => row.join(','))].join('\r\n')
}
