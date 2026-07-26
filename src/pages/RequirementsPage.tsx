import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FilterPanel } from '../components/FilterPanel'
import { AssessmentBadge, ClassificationBadge, StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/EmptyState'
import { useProjectStore } from '../store/projectStore'
import { currentAssessment, filterRequirements } from '../lib/filters'
import { lookupLabel } from '../lib/defaults'
import { formatDateTime } from '../lib/ids'
import type { ColumnId } from '../types/project'
import { ConfirmDialog } from '../components/Modal'

const COLUMN_LABELS: Record<ColumnId, string> = {
  sourceId: 'Source ID',
  shortTitle: 'Title',
  status: 'Status',
  classification: 'Classification',
  type: 'Type',
  priority: 'Priority',
  assessment: 'Assessment',
  verification: 'Verification',
  tags: 'Tags',
  sourceDocument: 'Source Doc',
  modifiedAt: 'Modified',
  editorName: 'Editor',
}

export function RequirementsPage() {
  const navigate = useNavigate()
  const project = useProjectStore((s) => s.project)!
  const mode = useProjectStore((s) => s.mode)
  const searchQuery = useProjectStore((s) => s.searchQuery)
  const filters = useProjectStore((s) => s.filters)
  const tagLogic = useProjectStore((s) => s.tagLogic)
  const sort = useProjectStore((s) => s.sort)
  const setSort = useProjectStore((s) => s.setSort)
  const visibleColumns = useProjectStore((s) => s.visibleColumns)
  const setVisibleColumns = useProjectStore((s) => s.setVisibleColumns)
  const selectedRequirementIds = useProjectStore((s) => s.selectedRequirementIds)
  const setSelectedRequirementIds = useProjectStore((s) => s.setSelectedRequirementIds)
  const page = useProjectStore((s) => s.page)
  const pageSize = useProjectStore((s) => s.pageSize)
  const setPage = useProjectStore((s) => s.setPage)
  const upsertSavedView = useProjectStore((s) => s.upsertSavedView)
  const duplicateRequirement = useProjectStore((s) => s.duplicateRequirement)
  const deleteRequirement = useProjectStore((s) => s.deleteRequirement)

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [columnsOpen, setColumnsOpen] = useState(false)

  const rows = useMemo(
    () => filterRequirements(project, searchQuery, filters, tagLogic, sort),
    [project, searchQuery, filters, tagLogic, sort],
  )

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize)

  const toggleSort = (field: string) => {
    const current = sort[0]
    if (current?.field === field) {
      setSort([{ field, direction: current.direction === 'asc' ? 'desc' : 'asc' }])
    } else {
      setSort([{ field, direction: 'asc' }])
    }
  }

  const deleteTarget = deleteId ? project.requirements.find((r) => r.id === deleteId) : null
  const deleteImpact = deleteId
    ? {
        relationships: project.relationships.filter(
          (r) => r.sourceRequirementId === deleteId || r.targetRequirementId === deleteId,
        ).length,
        activities: project.requirementActivityLinks.filter((l) => l.requirementId === deleteId).length,
        verifications: project.verifications.filter((v) => v.requirementId === deleteId).length,
        assessments: project.assessments.filter((a) => a.requirementId === deleteId).length,
        evidence: deleteTarget?.evidenceIds.length || 0,
      }
    : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Requirements</h2>
          <p className="text-sm text-[var(--color-ink-muted)]">
            Showing {rows.length} of {project.requirements.length}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => setColumnsOpen((v) => !v)}>
            Columns
          </button>
          {mode === 'edit' && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const name = window.prompt('Saved view name')
                  if (!name?.trim()) return
                  upsertSavedView({ name: name.trim() })
                }}
              >
                Save Current View
              </button>
              <button type="button" className="btn btn-primary" onClick={() => navigate('/requirements/new')}>
                New Requirement
              </button>
            </>
          )}
        </div>
      </div>

      <FilterPanel />

      {columnsOpen && (
        <div className="panel grid gap-2 p-4 sm:grid-cols-3 md:grid-cols-4">
          {(Object.keys(COLUMN_LABELS) as ColumnId[]).map((col) => (
            <label key={col} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={visibleColumns.includes(col)}
                onChange={(e) => {
                  if (e.target.checked) setVisibleColumns([...visibleColumns, col])
                  else if (visibleColumns.length > 1)
                    setVisibleColumns(visibleColumns.filter((c) => c !== col))
                }}
              />
              {COLUMN_LABELS[col]}
            </label>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title="No requirements match the current filters"
          body="Adjust search or filters, or create a requirement in Edit Mode."
        />
      ) : (
        <>
          <div className="table-wrap max-h-[70vh]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Select all on page"
                      checked={pageRows.every((r) => selectedRequirementIds.includes(r.id)) && pageRows.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRequirementIds(
                            Array.from(new Set([...selectedRequirementIds, ...pageRows.map((r) => r.id)])),
                          )
                        } else {
                          const pageIds = new Set(pageRows.map((r) => r.id))
                          setSelectedRequirementIds(selectedRequirementIds.filter((id) => !pageIds.has(id)))
                        }
                      }}
                    />
                  </th>
                  {visibleColumns.map((col) => (
                    <th key={col}>
                      <button type="button" className="font-inherit uppercase" onClick={() => toggleSort(col)}>
                        {COLUMN_LABELS[col]}
                        {sort[0]?.field === col ? (sort[0].direction === 'asc' ? ' ↑' : ' ↓') : ''}
                      </button>
                    </th>
                  ))}
                  {mode === 'edit' && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((req) => {
                  const status = lookupLabel(project.lookups.statuses, req.statusId)
                  const classification = lookupLabel(project.lookups.classifications, req.classificationId)
                  const assessment = currentAssessment(project, req.id)
                  const assessmentLabel = assessment
                    ? lookupLabel(project.lookups.assessmentResults, assessment.resultId)
                    : 'Not Yet Assessed'
                  const methods = project.verifications
                    .filter((v) => v.requirementId === req.id)
                    .map((v) => lookupLabel(project.lookups.verificationMethods, v.methodId))
                    .join(', ')
                  const tags = req.tagIds
                    .map((id) => project.tags.find((t) => t.id === id)?.name)
                    .filter(Boolean)
                    .join(', ')

                  const cell = (col: ColumnId) => {
                    switch (col) {
                      case 'sourceId':
                        return (
                          <Link className="font-semibold text-[var(--color-accent)] hover:underline" to={`/requirements/${req.id}`}>
                            {req.sourceId}
                          </Link>
                        )
                      case 'shortTitle':
                        return req.shortTitle || '—'
                      case 'status':
                        return <StatusBadge value={status} />
                      case 'classification':
                        return <ClassificationBadge value={classification} />
                      case 'type':
                        return lookupLabel(project.lookups.types, req.typeId)
                      case 'priority':
                        return lookupLabel(project.lookups.priorities, req.priorityId)
                      case 'assessment':
                        return <AssessmentBadge value={assessmentLabel} />
                      case 'verification':
                        return methods || '—'
                      case 'tags':
                        return tags || '—'
                      case 'sourceDocument':
                        return req.sourceDocument || '—'
                      case 'modifiedAt':
                        return formatDateTime(req.modifiedAt)
                      case 'editorName':
                        return req.editorName || '—'
                      default:
                        return '—'
                    }
                  }

                  return (
                    <tr key={req.id} className={selectedRequirementIds.includes(req.id) ? 'selected' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedRequirementIds.includes(req.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedRequirementIds([...selectedRequirementIds, req.id])
                            else setSelectedRequirementIds(selectedRequirementIds.filter((id) => id !== req.id))
                          }}
                        />
                      </td>
                      {visibleColumns.map((col) => (
                        <td key={col}>{cell(col)}</td>
                      ))}
                      {mode === 'edit' && (
                        <td>
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              className="btn btn-ghost px-2 py-1 text-xs"
                              onClick={() => {
                                const id = duplicateRequirement(req.id, project.metadata.editorNameDefault)
                                if (id) navigate(`/requirements/${id}`)
                              }}
                            >
                              Duplicate
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost px-2 py-1 text-xs text-[var(--color-danger)]"
                              onClick={() => setDeleteId(req.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div>
              Page {safePage} of {pageCount}
              {selectedRequirementIds.length > 0 && ` · ${selectedRequirementIds.length} selected`}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={safePage >= pageCount}
                onClick={() => setPage(safePage + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Permanently delete requirement?"
        danger
        confirmLabel="Delete Permanently"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteRequirement(deleteId)
          setDeleteId(null)
        }}
        message={
          deleteTarget && deleteImpact ? (
            <div className="space-y-2">
              <p>
                You are about to permanently delete <strong>{deleteTarget.sourceId}</strong>
                {deleteTarget.shortTitle ? ` — ${deleteTarget.shortTitle}` : ''}.
              </p>
              <ul className="list-disc pl-5">
                <li>{deleteImpact.relationships} relationship(s) will be removed</li>
                <li>{deleteImpact.activities} test-activity link(s) will be removed</li>
                <li>{deleteImpact.verifications} verification record(s) will be removed</li>
                <li>{deleteImpact.assessments} assessment record(s) will be removed</li>
                <li>{deleteImpact.evidence} evidence reference association(s) on this requirement</li>
              </ul>
              <p>This cannot be undone.</p>
            </div>
          ) : null
        }
      />
    </div>
  )
}
