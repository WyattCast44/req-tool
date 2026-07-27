import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore'
import { filterRequirements, currentAssessment } from '../lib/filters'
import { downloadTextFile, matrixToCsv, requirementsToCsv } from '../lib/export'
import { lookupLabel } from '../lib/defaults'
import { RichTextView } from '../components/RichText'
import { formatDateTime } from '../lib/ids'
import { RECIPROCAL_RELATIONSHIP } from '../types/project'

export function ReportsPage() {
  const [params] = useSearchParams()
  const project = useProjectStore((s) => s.project)!
  const searchQuery = useProjectStore((s) => s.searchQuery)
  const filters = useProjectStore((s) => s.filters)
  const tagLogic = useProjectStore((s) => s.tagLogic)
  const sort = useProjectStore((s) => s.sort)
  const selectedRequirementIds = useProjectStore((s) => s.selectedRequirementIds)
  const exportProject = useProjectStore((s) => s.exportProject)
  const matrixTypes = useProjectStore((s) => s.matrixTypes)

  const filtered = useMemo(
    () => filterRequirements(project, searchQuery, filters, tagLogic, sort),
    [project, searchQuery, filters, tagLogic, sort],
  )

  const selected = project.requirements.filter((r) => selectedRequirementIds.includes(r.id))
  const idsParam = params.get('ids')
  const reportIds = idsParam ? idsParam.split(',').filter(Boolean) : selectedRequirementIds
  const reportReqs =
    reportIds.length > 0
      ? project.requirements.filter((r) => reportIds.includes(r.id))
      : filtered.slice(0, 25)

  const matrixRels = project.relationships.filter((r) => {
    if (!matrixTypes.includes(r.type)) return false
    const ids = new Set(filtered.map((x) => x.id))
    return ids.has(r.sourceRequirementId) && ids.has(r.targetRequirementId)
  })

  return (
    <div className="space-y-2.5">
      <div>
        <h2 className="page-title">Reports & Exports</h2>
          <p className="page-subtitle">
            Generate portable project files, CSV products, and printer-friendly requirement reports.
          </p>
      </div>

      <section className="panel grid gap-3 p-4 md:grid-cols-2">
        <ExportCard
          title="Project save file (.otreq)"
          body="Export a complete replacement authoritative project database."
          actionLabel="Export Project File"
          onClick={() => void exportProject()}
        />
        <ExportCard
          title="CSV — all requirements"
          body={`Export all ${project.requirements.length} requirements.`}
          actionLabel="Export All CSV"
          onClick={() =>
            downloadTextFile(
              `${project.metadata.name.replace(/\s+/g, '_')}_requirements_all.csv`,
              requirementsToCsv(project, project.requirements),
              'text/csv',
            )
          }
        />
        <ExportCard
          title="CSV — filtered requirements"
          body={`Export the current filtered set (${filtered.length}).`}
          actionLabel="Export Filtered CSV"
          onClick={() =>
            downloadTextFile(
              `${project.metadata.name.replace(/\s+/g, '_')}_requirements_filtered.csv`,
              requirementsToCsv(project, filtered),
              'text/csv',
            )
          }
        />
        <ExportCard
          title="CSV — selected requirements"
          body={`Export ${selected.length} selected row(s) from the requirements table.`}
          actionLabel="Export Selected CSV"
          onClick={() => {
            if (!selected.length) {
              window.alert('Select one or more requirements in the Requirements table first.')
              return
            }
            downloadTextFile(
              `${project.metadata.name.replace(/\s+/g, '_')}_requirements_selected.csv`,
              requirementsToCsv(project, selected),
              'text/csv',
            )
          }}
        />
        <ExportCard
          title="Traceability matrix CSV"
          body={`Export ${matrixRels.length} relationship row(s) for the current filtered matrix scope.`}
          actionLabel="Export Matrix CSV"
          onClick={() =>
            downloadTextFile(
              `${project.metadata.name.replace(/\s+/g, '_')}_traceability_matrix.csv`,
              matrixToCsv(project, matrixRels),
              'text/csv',
            )
          }
        />
        <ExportCard
          title="Printable requirement report"
          body={`Print ${reportReqs.length} requirement(s) using the browser print dialog (Save as PDF).`}
          actionLabel="Print Report"
          onClick={() => window.print()}
        />
      </section>

      <section className="print-area panel p-6">
        <div className="mb-6 border-b border-[var(--color-line)] pb-4">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
            Requirement Report
          </div>
          <h3 className="font-[family-name:var(--font-display)] text-2xl font-semibold">{project.metadata.name}</h3>
          {project.metadata.classificationBanner && (
            <div className="mt-2 text-sm font-bold">{project.metadata.classificationBanner}</div>
          )}
          <p className="text-sm text-[var(--color-ink-muted)]">Generated {formatDateTime(new Date().toISOString())}</p>
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

            return (
              <article key={req.id} className="mb-8 break-inside-avoid border-b border-[var(--color-line)] pb-6">
                <h4 className="text-lg font-semibold">
                  {req.sourceId} — {req.shortTitle || 'Untitled'}
                </h4>
                <div className="mt-2 grid gap-1 text-sm md:grid-cols-2">
                  <div>Status: {lookupLabel(project.lookups.statuses, req.statusId)}</div>
                  <div>Classification: {lookupLabel(project.lookups.classifications, req.classificationId)}</div>
                  <div>Type: {lookupLabel(project.lookups.types, req.typeId)}</div>
                  <div>Priority: {lookupLabel(project.lookups.priorities, req.priorityId)}</div>
                  <div>Source: {req.sourceDocument || '—'} {req.sourceDocumentVersion} {req.sourceSection}</div>
                  <div>Tags: {tags.join(', ') || '—'}</div>
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
  )
}

function ExportCard({
  title,
  body,
  actionLabel,
  onClick,
}: {
  title: string
  body: string
  actionLabel: string
  onClick: () => void
}) {
  return (
    <div className="rounded-md border border-[var(--color-line)] p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{body}</p>
      <button type="button" className="btn btn-secondary mt-3 no-print" onClick={onClick}>
        {actionLabel}
      </button>
    </div>
  )
}
