import { Link } from 'react-router-dom'
import { AssessmentBadge, ClassificationBadge, StatusBadge } from './StatusBadge'
import { cheapPlainText, currentAssessment } from '../lib/filters'
import { lookupLabel } from '../lib/defaults'
import type { ProjectData, Requirement } from '../types/project'

const TEXT_PREVIEW_LIMIT = 180

export function RequirementHoverPreview({
  requirement,
  project,
  className = '',
}: {
  requirement: Requirement
  project: ProjectData
  className?: string
}) {
  const status = lookupLabel(project.lookups.statuses, requirement.statusId)
  const classification = lookupLabel(project.lookups.classifications, requirement.classificationId)
  const type = lookupLabel(project.lookups.types, requirement.typeId)
  const priority = lookupLabel(project.lookups.priorities, requirement.priorityId)
  const assessment = currentAssessment(project, requirement.id)
  const assessmentLabel = assessment
    ? lookupLabel(project.lookups.assessmentResults, assessment.resultId)
    : 'Not Yet Assessed'
  const tags = requirement.tagIds
    .map((id) => project.tags.find((tag) => tag.id === id)?.name)
    .filter(Boolean) as string[]
  const body =
    cheapPlainText(requirement.requirementText) ||
    cheapPlainText(requirement.description) ||
    ''
  const preview =
    body.length > TEXT_PREVIEW_LIMIT ? `${body.slice(0, TEXT_PREVIEW_LIMIT).trim()}…` : body
  const linkedSources = (project.requirementSourceLinks ?? []).filter(
    (link) => link.requirementId === requirement.id,
  ).length
  const relationships = project.relationships.filter(
    (rel) =>
      rel.sourceRequirementId === requirement.id || rel.targetRequirementId === requirement.id,
  ).length

  return (
    <article className={`requirement-hover-preview ${className}`.trim()}>
      <header className="space-y-1">
        <Link
          to={`/requirements/${requirement.id}`}
          className="mono text-[0.68rem] font-semibold text-[var(--color-accent)] hover:underline"
        >
          {requirement.sourceId || 'No ID'}
        </Link>
        <h4 className="text-[0.86rem] font-semibold leading-snug text-[var(--color-ink)]">
          {requirement.shortTitle || 'Untitled requirement'}
        </h4>
      </header>

      <div className="mt-2 flex flex-wrap gap-1">
        <StatusBadge value={status} />
        <ClassificationBadge value={classification} />
        <AssessmentBadge value={assessmentLabel} />
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[0.7rem]">
        <div>
          <dt className="text-[var(--color-ink-muted)]">Type</dt>
          <dd className="font-medium">{type || '—'}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-ink-muted)]">Priority</dt>
          <dd className="font-medium">{priority || '—'}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-ink-muted)]">Sources</dt>
          <dd className="font-medium">{linkedSources}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-ink-muted)]">Relationships</dt>
          <dd className="font-medium">{relationships}</dd>
        </div>
      </dl>

      {preview ? (
        <p className="mt-2 text-[0.72rem] leading-snug text-[var(--color-ink)]">{preview}</p>
      ) : (
        <p className="mt-2 text-[0.72rem] italic text-[var(--color-ink-muted)]">
          No requirement text yet.
        </p>
      )}

      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.slice(0, 6).map((tag) => (
            <span key={tag} className="badge border-[var(--color-line)] bg-[var(--color-panel)]">
              {tag}
            </span>
          ))}
          {tags.length > 6 && (
            <span className="text-[0.65rem] text-[var(--color-ink-muted)]">+{tags.length - 6}</span>
          )}
        </div>
      )}
    </article>
  )
}
