import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { ColumnDef, RowSelectionState, VisibilityState } from '@tanstack/react-table'
import { FilterPanel } from '../components/FilterPanel'
import { AssessmentBadge, ClassificationBadge, StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/EmptyState'
import { DataTable } from '../components/DataTable'
import { PageHeader } from '../components/PageHeader'
import { fuzzyIncludesFilter } from '../lib/tableFilters'
import { useProjectStore } from '../store/projectStore'
import { currentAssessment, filterRequirements } from '../lib/filters'
import { buildProjectIndexes } from '../lib/projectIndexes'
import { lookupLabel } from '../lib/defaults'
import { formatDateTime } from '../lib/ids'
import { DEFAULT_COLUMNS, type ColumnId, type ProjectData, type Requirement } from '../types/project'
import { ConfirmDialog } from '../components/Modal'
import { useRequirementViewState } from '../lib/urlState'
import { downloadTextFile, requirementsToCsv } from '../lib/export'
import { downloadRequirementsDocx } from '../lib/requirementsDocxExport'

interface RequirementRow {
  id: string
  sourceId: string
  shortTitle: string
  status: string
  classification: string
  type: string
  priority: string
  assessment: string
  verification: string
  tags: string
  sources: string
  modifiedAt: string
  modifiedAtRaw: string
  editorName: string
  requirement: Requirement
}

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
  sources: 'Sources',
  modifiedAt: 'Modified',
  editorName: 'Editor',
}

const DEFAULT_REQUIREMENT_SORTING = [{ id: 'sourceId', desc: false }]

function toRows(project: ProjectData, requirements: Requirement[]): RequirementRow[] {
  const indexes = buildProjectIndexes(project)
  return requirements.map((req) => {
    const assessment = currentAssessment(project, req.id, indexes)
    const assessmentLabel = assessment
      ? lookupLabel(project.lookups.assessmentResults, assessment.resultId)
      : 'Not Yet Assessed'
    const methods = (indexes.verificationsByReq.get(req.id) || [])
      .map((v) => lookupLabel(project.lookups.verificationMethods, v.methodId))
      .join(', ')
    const tags = req.tagIds
      .map((id) => project.tags.find((t) => t.id === id)?.name)
      .filter(Boolean)
      .join(', ')
    const ownedSource = req.sourceDocumentId
      ? indexes.sourceById.get(req.sourceDocumentId)
      : undefined
    const linkedSources = (indexes.sourceLinksByReq.get(req.id) || [])
      .map((link) => {
        const source = indexes.sourceById.get(link.sourceId)
        return source?.identifier || source?.title
      })
      .filter(Boolean)
    const sourceLabels = [
      ...(ownedSource ? [ownedSource.identifier || ownedSource.title] : []),
      ...linkedSources.filter(
        (label) => label && label !== (ownedSource?.identifier || ownedSource?.title),
      ),
    ]
    return {
      id: req.id,
      sourceId: req.sourceId,
      shortTitle: req.shortTitle || '',
      status: lookupLabel(project.lookups.statuses, req.statusId),
      classification: lookupLabel(project.lookups.classifications, req.classificationId),
      type: lookupLabel(project.lookups.types, req.typeId),
      priority: lookupLabel(project.lookups.priorities, req.priorityId),
      assessment: assessmentLabel,
      verification: methods,
      tags,
      sources: sourceLabels.join(', '),
      modifiedAt: formatDateTime(req.modifiedAt),
      modifiedAtRaw: req.modifiedAt,
      editorName: req.editorName || '',
      requirement: req,
    }
  })
}

export function RequirementsPage() {
  const navigate = useNavigate()
  const [urlParams] = useSearchParams()
  const requirementDetailSuffix = urlParams.toString() ? `?${urlParams.toString()}` : ''
  const project = useProjectStore((s) => s.project)!
  const mode = useProjectStore((s) => s.mode)
  const {
    searchQuery,
    filters,
    tagLogic,
    sort,
    visibleColumns,
    selectedRequirementIds,
    setSelectedRequirementIds,
    setActiveSavedViewId,
  } = useRequirementViewState()
  const upsertSavedView = useProjectStore((s) => s.upsertSavedView)
  const duplicateRequirement = useProjectStore((s) => s.duplicateRequirement)
  const deleteRequirement = useProjectStore((s) => s.deleteRequirement)
  const setToast = useProjectStore((s) => s.setToast)

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [wordExportStatus, setWordExportStatus] = useState('')

  // Domain filters from FilterPanel / dashboard / saved views (not TanStack column filters)
  const filteredRequirements = useMemo(
    () => filterRequirements(project, searchQuery, filters, tagLogic, [{ field: 'sourceId', direction: 'asc' }]),
    [project, searchQuery, filters, tagLogic],
  )

  const rows = useMemo(() => toRows(project, filteredRequirements), [project, filteredRequirements])

  const defaultColumnVisibility: VisibilityState = useMemo(() => {
    const visibility: VisibilityState = {}
    ;(Object.keys(COLUMN_LABELS) as ColumnId[]).forEach((col) => {
      visibility[col] = (DEFAULT_COLUMNS as readonly ColumnId[]).includes(col)
    })
    return visibility
  }, [])

  const selectedRequirements = useMemo(() => {
    const selectedIds = new Set(selectedRequirementIds)
    return project.requirements.filter((requirement) => selectedIds.has(requirement.id))
  }, [project.requirements, selectedRequirementIds])

  const validSelectedRequirementIds = useMemo(
    () => selectedRequirements.map((requirement) => requirement.id),
    [selectedRequirements],
  )

  useEffect(() => {
    if (validSelectedRequirementIds.length === selectedRequirementIds.length) return
    setSelectedRequirementIds(validSelectedRequirementIds)
  }, [
    selectedRequirementIds.length,
    setSelectedRequirementIds,
    validSelectedRequirementIds,
  ])

  const rowSelection: RowSelectionState = useMemo(
    () => Object.fromEntries(validSelectedRequirementIds.map((id) => [id, true])),
    [validSelectedRequirementIds],
  )

  const columns = useMemo<ColumnDef<RequirementRow>[]>(() => {
    const defs: ColumnDef<RequirementRow>[] = [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label="Select all on page"
            checked={table.getIsAllPageRowsSelected()}
            ref={(el) => {
              if (el) el.indeterminate = table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
            }}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.sourceId}`}
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
        enableColumnFilter: false,
        enableHiding: false,
        enableResizing: false,
        size: 36,
        minSize: 36,
        maxSize: 36,
      },
      {
        accessorKey: 'sourceId',
        header: 'Source ID',
        cell: ({ row }) => (
          <Link
            className="mono font-semibold text-[var(--color-accent)] hover:underline"
            to={`/requirements/${row.original.id}${requirementDetailSuffix}`}
          >
            {row.original.sourceId}
          </Link>
        ),
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.sourceId, value),
        size: 110,
        minSize: 80,
      },
      {
        accessorKey: 'shortTitle',
        header: 'Title',
        cell: ({ getValue }) => (getValue<string>() ? getValue<string>() : '—'),
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.shortTitle, value),
        size: 200,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => <StatusBadge value={getValue<string>()} />,
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.status, value),
        size: 120,
      },
      {
        accessorKey: 'classification',
        header: 'Classification',
        cell: ({ getValue }) => <ClassificationBadge value={getValue<string>()} />,
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.classification, value),
        size: 120,
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ getValue }) => getValue<string>() || '—',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.type, value),
        size: 110,
      },
      {
        accessorKey: 'priority',
        header: 'Priority',
        cell: ({ getValue }) => getValue<string>() || '—',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.priority, value),
        size: 90,
      },
      {
        accessorKey: 'assessment',
        header: 'Assessment',
        cell: ({ getValue }) => <AssessmentBadge value={getValue<string>()} />,
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.assessment, value),
        size: 130,
      },
      {
        accessorKey: 'verification',
        header: 'Verification',
        cell: ({ getValue }) => getValue<string>() || '—',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.verification, value),
        size: 130,
      },
      {
        accessorKey: 'tags',
        header: 'Tags',
        cell: ({ getValue }) => getValue<string>() || '—',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.tags, value),
        size: 150,
      },
      {
        accessorKey: 'sources',
        header: 'Sources',
        cell: ({ getValue }) => getValue<string>() || '—',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.sources, value),
        size: 100,
      },
      {
        accessorKey: 'modifiedAt',
        header: 'Modified',
        cell: ({ row }) => row.original.modifiedAt,
        sortingFn: (a, b) => a.original.modifiedAtRaw.localeCompare(b.original.modifiedAtRaw),
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.modifiedAt, value),
        size: 150,
      },
      {
        accessorKey: 'editorName',
        header: 'Editor',
        cell: ({ getValue }) => getValue<string>() || '—',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.editorName, value),
        size: 110,
      },
    ]

    if (mode === 'edit') {
      defs.push({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                const id = duplicateRequirement(row.original.id, project.metadata.editorNameDefault)
                if (id) navigate(`/requirements/${id}${requirementDetailSuffix}`)
              }}
            >
              Duplicate
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-ghost-danger"
              onClick={() => setDeleteId(row.original.id)}
            >
              Delete
            </button>
          </div>
        ),
        enableSorting: false,
        enableColumnFilter: false,
        enableHiding: false,
        enableResizing: true,
        size: 130,
      })
    }

    return defs
  }, [
    mode,
    duplicateRequirement,
    navigate,
    project.metadata.editorNameDefault,
    requirementDetailSuffix,
  ])

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
    <div className="space-y-2">
      <PageHeader
        title="Requirements"
        subtitle={
          <>
            Showing {filteredRequirements.length} of {project.requirements.length}
            {filteredRequirements.length !== project.requirements.length
              ? ' · filters or search are narrowing this list'
              : ''}
            {searchQuery ? ` · search “${searchQuery}”` : ''}
          </>
        }
        actions={
          mode === 'edit' ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const name = window.prompt('Saved view name')
                  if (!name?.trim()) return
                  const id = upsertSavedView({
                    name: name.trim(),
                    searchQuery,
                    filters,
                    tagLogic,
                    sort,
                    visibleColumns,
                  })
                  if (id) setActiveSavedViewId(id)
                }}
              >
                Save Current View
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate(`/requirements/new${requirementDetailSuffix}`)}
              >
                New Requirement
              </button>
            </>
          ) : undefined
        }
      />

      <FilterPanel />

      {validSelectedRequirementIds.length > 0 && (
        <div className="panel flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <div className="text-sm">
            <span className="font-semibold">{validSelectedRequirementIds.length}</span>
            <span className="text-[var(--color-ink-muted)]">
              {' '}
              requirement{validSelectedRequirementIds.length === 1 ? '' : 's'} selected
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const next = new URLSearchParams(urlParams)
                next.set('ids', validSelectedRequirementIds.join(','))
                navigate(`/print?${next.toString()}`)
              }}
            >
              Print Report
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                downloadTextFile(
                  `${project.metadata.name.replace(/\s+/g, '_')}_requirements_selected.csv`,
                  requirementsToCsv(project, selectedRequirements),
                  'text/csv',
                )
              }}
            >
              Export Selected CSV
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={Boolean(wordExportStatus)}
              onClick={() => {
                if (wordExportStatus) return
                setWordExportStatus('Starting Word export…')
                void downloadRequirementsDocx(
                  project,
                  selectedRequirements.map((requirement) => requirement.id),
                  'selected',
                  setWordExportStatus,
                )
                  .then(() => setToast('Selected requirements exported to Word.'))
                  .catch((error: unknown) => {
                    setToast(
                      error instanceof Error
                        ? error.message
                        : 'Could not generate the Word document.',
                    )
                  })
                  .finally(() => setWordExportStatus(''))
              }}
            >
              {wordExportStatus || 'Export Selected Word'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setSelectedRequirementIds([])}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {filteredRequirements.length === 0 ? (
        <EmptyState
          title="No requirements match the current filters"
          body="Adjust search or filters, or create a requirement in Edit Mode."
        />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          getRowId={(row) => row.id}
          pageSize={100}
          urlStateKey=""
          defaultSorting={DEFAULT_REQUIREMENT_SORTING}
          defaultColumnVisibility={defaultColumnVisibility}
          sizingStorageKey="requirements"
          enableRowSelection
          rowSelection={rowSelection}
          onRowSelectionChange={(updater) => {
            const next = typeof updater === 'function' ? updater(rowSelection) : updater
            setSelectedRequirementIds(Object.keys(next).filter((id) => next[id]))
          }}
          emptyMessage="No rows match the current column filters."
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Permanently delete requirement?"
        danger
        confirmLabel="Delete Permanently"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            setSelectedRequirementIds(
              validSelectedRequirementIds.filter((id) => id !== deleteId),
            )
            deleteRequirement(deleteId, project.metadata.editorNameDefault)
          }
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
