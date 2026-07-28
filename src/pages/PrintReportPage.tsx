import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore'
import { filterRequirements, currentAssessment } from '../lib/filters'
import { lookupLabel } from '../lib/defaults'
import { RichTextView } from '../components/RichText'
import { formatDateTime } from '../lib/ids'
import { RECIPROCAL_RELATIONSHIP } from '../types/project'
import { useRequirementViewState } from '../lib/urlState'

function ClassificationBanner({ text, position }: { text: string; position: 'top' | 'bottom' }) {
  if (!text.trim()) return null
  return (
    <div
      className={`print-classification-banner print-classification-banner-${position} bg-[var(--color-banner)] px-3 py-1.5 text-center text-[0.7rem] font-bold uppercase tracking-[0.14em] text-white`}
    >
      {text}
    </div>
  )
}

export function PrintReportPage() {
  const [params] = useSearchParams()
  const project = useProjectStore((s) => s.project)!
  const { searchQuery, filters, tagLogic, sort, selectedRequirementIds } =
    useRequirementViewState()
  const [printClassification, setPrintClassification] = useState(
    () => project.metadata.classificationBanner || '',
  )

  const filtered = useMemo(
    () => filterRequirements(project, searchQuery, filters, tagLogic, sort),
    [project, searchQuery, filters, tagLogic, sort],
  )

  const printAll = params.get('scope') === 'all'
  const idsParam = params.get('ids')
  const reportIds = idsParam ? idsParam.split(',').filter(Boolean) : selectedRequirementIds
  const reportReqs =
    printAll
      ? project.requirements
      : reportIds.length > 0
      ? project.requirements.filter((r) => reportIds.includes(r.id))
      : filtered.slice(0, 25)

  return (
    <div className="min-h-full bg-[var(--color-shell)]">
      <div className="no-print border-b border-[var(--color-line)] bg-white px-4 py-2">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <Link
            to={`/reports${params.toString() ? `?${params.toString()}` : ''}`}
            className="text-sm text-[var(--color-accent)] hover:underline"
          >
            ← Reports & Exports
          </Link>
          <label className="flex min-w-0 flex-1 items-center gap-2 md:max-w-md">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-muted)]">
              Print classification
            </span>
            <input
              className="field-input"
              value={printClassification}
              onChange={(e) => setPrintClassification(e.target.value)}
              placeholder="e.g., UNCLASSIFIED // FOR OFFICIAL USE ONLY"
            />
          </label>
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            Print Report
          </button>
        </div>
      </div>

      <ClassificationBanner text={printClassification} position="top" />

      <div className="mx-auto max-w-4xl p-4 md:p-6">
        <section className="print-area panel p-6">
          <div className="mb-6 border-b border-[var(--color-line)] pb-4">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
              Requirement Report
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
              {project.metadata.name}
            </h1>
            <p className="muted-copy">
              Generated {formatDateTime(new Date().toISOString())}
            </p>
          </div>

          {reportReqs.length === 0 ? (
            <p className="text-sm">No requirements available for report preview.</p>
          ) : (
            reportReqs.map((req) => {
              const assessment = currentAssessment(project, req.id)
              const rels = project.relationships.filter(
                (r) => r.sourceRequirementId === req.id || r.targetRequirementId === req.id,
              )
              const activities = project.requirementActivityLinks
                .filter((l) => l.requirementId === req.id)
                .map((l) => project.testActivities.find((t) => t.id === l.testActivityId)?.title)
                .filter(Boolean)
              const methods = project.verifications
                .filter((v) => v.requirementId === req.id)
                .map((v) => lookupLabel(project.lookups.verificationMethods, v.methodId))
              const tags = req.tagIds
                .map((id) => project.tags.find((t) => t.id === id)?.name)
                .filter(Boolean)
              const evidence = req.evidenceIds
                .map((id) => project.evidence.find((e) => e.id === id))
                .filter(Boolean)
              const sourceLinks = (project.requirementSourceLinks ?? []).filter(
                (link) => link.requirementId === req.id,
              )

              return (
                <article
                  key={req.id}
                  className="mb-8 break-inside-avoid border-b border-[var(--color-line)] pb-6 last:mb-0 last:border-b-0 last:pb-0"
                >
                  <h2 className="text-lg font-semibold">
                    {req.sourceId} — {req.shortTitle || 'Untitled'}
                  </h2>
                  <div className="mt-2 grid gap-1 text-sm md:grid-cols-2">
                    <div>Status: {lookupLabel(project.lookups.statuses, req.statusId)}</div>
                    <div>
                      Classification: {lookupLabel(project.lookups.classifications, req.classificationId)}
                    </div>
                    <div>Type: {lookupLabel(project.lookups.types, req.typeId)}</div>
                    <div>Priority: {lookupLabel(project.lookups.priorities, req.priorityId)}</div>
                    <div>Tags: {tags.join(', ') || '—'}</div>
                  </div>
                  <div className="mt-3 text-sm">
                    <div className="field-label">Linked watch items</div>
                    {project.watchItems
                      .filter((watchItem) => watchItem.requirementIds.includes(req.id))
                      .map((watchItem) => `${watchItem.title} (${watchItem.status})`)
                      .join(', ') || '—'}
                  </div>
                  <div className="mt-3">
                    <div className="field-label">Requirement text</div>
                    <RichTextView html={req.requirementText} />
                  </div>
                  {req.description && (
                    <div className="mt-3">
                      <div className="field-label">Description</div>
                      <RichTextView html={req.description} />
                    </div>
                  )}
                  <div className="mt-3 text-sm">
                    <div>Verification methods: {methods.join(', ') || '—'}</div>
                    <div>Planned test activities: {activities.join(', ') || '—'}</div>
                    <div>
                      Assessment:{' '}
                      {assessment
                        ? lookupLabel(project.lookups.assessmentResults, assessment.resultId)
                        : 'Not Yet Assessed'}
                    </div>
                  </div>
                  {assessment?.narrative && (
                    <div className="mt-2">
                      <div className="field-label">Assessment narrative</div>
                      <RichTextView html={assessment.narrative} />
                    </div>
                  )}
                  <div className="mt-3 text-sm">
                    <div className="field-label">Sources</div>
                    {sourceLinks.length === 0 && <div>—</div>}
                    <ul className="list-disc space-y-1 pl-5">
                      {sourceLinks.map((link) => {
                        const source = (project.sources ?? []).find((item) => item.id === link.sourceId)
                        return (
                          <li key={link.id}>
                            <span>
                              {link.type} {source?.identifier || source?.title || 'Missing source'}
                              {link.locator ? ` — ${link.locator}` : ''}
                            </span>
                            {link.rationale && <RichTextView html={link.rationale} />}
                            {link.notes && <RichTextView html={link.notes} />}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                  <div className="mt-3 text-sm">
                    <div className="field-label">Relationships</div>
                    {rels.length === 0 && <div>—</div>}
                    <ul className="list-disc pl-5">
                      {rels.map((rel) => {
                        const outgoing = rel.sourceRequirementId === req.id
                        const otherId = outgoing ? rel.targetRequirementId : rel.sourceRequirementId
                        const other = project.requirements.find((r) => r.id === otherId)
                        const type = outgoing ? rel.type : RECIPROCAL_RELATIONSHIP[rel.type] || rel.type
                        return (
                          <li key={rel.id}>
                            {type} {other?.sourceId || 'Missing'}
                            {rel.rationale ? ` — ${rel.rationale}` : ''}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                  <div className="mt-3 text-sm">
                    <div className="field-label">Evidence references</div>
                    {evidence.length === 0 && <div>—</div>}
                    <ul className="list-disc pl-5">
                      {evidence.map((ev) =>
                        ev ? (
                          <li key={ev.id}>
                            {ev.title || ev.fileName}: {ev.filePath}
                            {ev.sectionOrPage ? ` (${ev.sectionOrPage})` : ''}
                          </li>
                        ) : null,
                      )}
                    </ul>
                  </div>
                  <div className="mt-3 text-xs text-[var(--color-ink-muted)]">
                    Created {formatDateTime(req.createdAt)} · Modified {formatDateTime(req.modifiedAt)} by{' '}
                    {req.editorName || '—'} · {req.changeSummary || '—'}
                  </div>
                </article>
              )
            })
          )}
        </section>
      </div>

      <ClassificationBanner text={printClassification} position="bottom" />
    </div>
  )
}
