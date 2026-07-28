import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore'
import { filterRequirements } from '../lib/filters'
import { downloadTextFile, matrixToCsv, requirementsToCsv, watchItemsToCsv } from '../lib/export'
import { useMatrixUrlState, useRequirementViewState } from '../lib/urlState'
import { downloadRequirementsDocx } from '../lib/requirementsDocxExport'
import { PageHeader } from '../components/PageHeader'

export function ReportsPage() {
  const navigate = useNavigate()
  const project = useProjectStore((s) => s.project)!
  const { searchQuery, filters, tagLogic, sort } = useRequirementViewState()
  const exportProject = useProjectStore((s) => s.exportProject)
  const setToast = useProjectStore((s) => s.setToast)
  const { types: matrixTypes } = useMatrixUrlState()
  const [wordExportStatus, setWordExportStatus] = useState('')

  const filtered = useMemo(
    () => filterRequirements(project, searchQuery, filters, tagLogic, sort),
    [project, searchQuery, filters, tagLogic, sort],
  )

  const matrixRels = project.relationships.filter((r) => {
    if (!matrixTypes.includes(r.type)) return false
    const ids = new Set(filtered.map((x) => x.id))
    return ids.has(r.sourceRequirementId) && ids.has(r.targetRequirementId)
  })

  return (
    <div className="space-y-2.5">
      <PageHeader
        title="Reports & Exports"
        subtitle="Generate portable project files, CSV products, and printer-friendly requirement reports."
      />

      <section className="grid gap-3 md:grid-cols-2">
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
          title="CSV — watch items"
          body={`Export all ${project.watchItems.length} watch items with observations and linked records.`}
          actionLabel="Export Watch Items CSV"
          onClick={() =>
            downloadTextFile(
              `${project.metadata.name.replace(/\s+/g, '_')}_watch_items.csv`,
              watchItemsToCsv(project),
              'text/csv',
            )
          }
        />
        <ExportCard
          title="Word — all requirements"
          body={`Generate a Word document containing all ${project.requirements.length} requirements in the background.`}
          actionLabel={wordExportStatus || 'Export All Word'}
          disabled={Boolean(wordExportStatus)}
          onClick={() => {
            if (wordExportStatus) return
            setWordExportStatus('Starting Word export…')
            void downloadRequirementsDocx(
              project,
              project.requirements.map((requirement) => requirement.id),
              'all',
              setWordExportStatus,
            )
              .then(() => setToast('All requirements exported to Word.'))
              .catch((error: unknown) => {
                setToast(
                  error instanceof Error
                    ? error.message
                    : 'Could not generate the Word document.',
                )
              })
              .finally(() => setWordExportStatus(''))
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
          title="Print all requirements"
          body={`Open a clean print preview for all ${project.requirements.length} requirements, then use Print / Save as PDF.`}
          actionLabel="Open Print Preview"
          onClick={() => navigate('/print?scope=all')}
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
  disabled = false,
}: {
  title: string
  body: string
  actionLabel: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h3>{title}</h3>
      </div>
      <div className="panel-body">
        <p className="muted-copy">{body}</p>
        <button
          type="button"
          className="btn btn-secondary mt-3"
          disabled={disabled}
          onClick={onClick}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  )
}
