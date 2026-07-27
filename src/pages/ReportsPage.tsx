import { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore'
import { filterRequirements } from '../lib/filters'
import { downloadTextFile, matrixToCsv, requirementsToCsv } from '../lib/export'

export function ReportsPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const project = useProjectStore((s) => s.project)!
  const searchQuery = useProjectStore((s) => s.searchQuery)
  const filters = useProjectStore((s) => s.filters)
  const tagLogic = useProjectStore((s) => s.tagLogic)
  const sort = useProjectStore((s) => s.sort)
  const selectedRequirementIds = useProjectStore((s) => s.selectedRequirementIds)
  const setSelectedRequirementIds = useProjectStore((s) => s.setSelectedRequirementIds)
  const exportProject = useProjectStore((s) => s.exportProject)
  const matrixTypes = useProjectStore((s) => s.matrixTypes)

  const idsParam = params.get('ids')
  useEffect(() => {
    if (!idsParam) return
    const ids = idsParam.split(',').filter(Boolean)
    if (ids.length) setSelectedRequirementIds(ids)
  }, [idsParam, setSelectedRequirementIds])

  const filtered = useMemo(
    () => filterRequirements(project, searchQuery, filters, tagLogic, sort),
    [project, searchQuery, filters, tagLogic, sort],
  )

  const reportIds = idsParam
    ? idsParam.split(',').filter(Boolean)
    : selectedRequirementIds
  const selected = project.requirements.filter((r) => reportIds.includes(r.id))
  const reportCount =
    reportIds.length > 0 ? reportIds.length : Math.min(filtered.length, 25)

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
          body={`Open a clean print preview for ${reportCount} requirement(s), then use Print / Save as PDF.`}
          actionLabel="Open Print Preview"
          onClick={() => {
            const qs =
              reportIds.length > 0 ? `?ids=${encodeURIComponent(reportIds.join(','))}` : ''
            navigate(`/print${qs}`)
          }}
        />
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
      <button type="button" className="btn btn-secondary mt-3" onClick={onClick}>
        {actionLabel}
      </button>
    </div>
  )
}
