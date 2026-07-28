import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useProjectStore } from '../store/projectStore'
import { filterRequirements } from '../lib/filters'
import { RELATIONSHIP_TYPES, type RelationshipType, type Requirement } from '../types/project'
import { downloadTextFile, matrixToCsv } from '../lib/export'
import { FilterPanel } from '../components/FilterPanel'
import { PageHeader } from '../components/PageHeader'
import { DataTable } from '../components/DataTable'
import { RequirementHoverLink } from '../components/RequirementHoverLink'
import { useMatrixUrlState, useRequirementViewState } from '../lib/urlState'

interface MatrixRow {
  id: string
  sourceId: string
  requirement: Requirement
}

const COL_PAGE_SIZE = 25

export function MatrixPage() {
  const project = useProjectStore((s) => s.project)!
  const { searchQuery, filters, tagLogic, sort } = useRequirementViewState()
  const {
    types: matrixTypes,
    colPage: requestedColPage,
    setTypes: setMatrixTypes,
    setColPage,
  } = useMatrixUrlState()

  const filtered = useMemo(
    () => filterRequirements(project, searchQuery, filters, tagLogic, sort),
    [project, searchQuery, filters, tagLogic, sort],
  )

  const colCount = Math.max(1, Math.ceil(filtered.length / COL_PAGE_SIZE))
  const colPage = Math.min(requestedColPage, colCount)
  const cols = filtered.slice((colPage - 1) * COL_PAGE_SIZE, colPage * COL_PAGE_SIZE)

  const relMap = useMemo(() => {
    const map = new Map<string, { type: RelationshipType; id: string; rationale: string }>()
    for (const rel of project.relationships) {
      if (!matrixTypes.includes(rel.type)) continue
      map.set(`${rel.sourceRequirementId}|${rel.targetRequirementId}`, {
        type: rel.type,
        id: rel.id,
        rationale: rel.rationale,
      })
    }
    return map
  }, [project.relationships, matrixTypes])

  const rows = useMemo<MatrixRow[]>(
    () =>
      filtered.map((requirement) => ({
        id: requirement.id,
        sourceId: requirement.sourceId,
        requirement,
      })),
    [filtered],
  )

  const columns = useMemo<ColumnDef<MatrixRow>[]>(() => {
    const defs: ColumnDef<MatrixRow>[] = [
      {
        id: 'requirement',
        accessorKey: 'sourceId',
        header: 'Requirement',
        cell: ({ row }) => (
          <RequirementHoverLink requirement={row.original.requirement} project={project} />
        ),
        enableColumnFilter: false,
        enableHiding: false,
        size: 160,
        minSize: 100,
      },
    ]

    for (const col of cols) {
      defs.push({
        id: col.id,
        accessorFn: (row) => {
          if (row.id === col.id) return '—'
          const hit = relMap.get(`${row.id}|${col.id}`)
          return hit ? abbreviate(hit.type) : ''
        },
        header: () => (
          <div className="matrix-col-header" title={col.shortTitle || col.sourceId}>
            <RequirementHoverLink requirement={col} project={project} />
          </div>
        ),
        cell: ({ row }) => {
          if (row.original.id === col.id) {
            return <span className="block text-center text-[var(--color-ink-muted)]">—</span>
          }
          const hit = relMap.get(`${row.original.id}|${col.id}`)
          if (!hit) return null
          return (
            <span className="flex justify-center">
              <span
                className="badge border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                title={hit.rationale || ''}
              >
                {abbreviate(hit.type)}
              </span>
            </span>
          )
        },
        enableSorting: false,
        enableColumnFilter: false,
        enableHiding: false,
        size: 44,
        minSize: 36,
        maxSize: 120,
      })
    }

    return defs
  }, [cols, project, relMap])

  const exportRows = project.relationships.filter((r) => {
    if (!matrixTypes.includes(r.type)) return false
    const ids = new Set(filtered.map((x) => x.id))
    return ids.has(r.sourceRequirementId) && ids.has(r.targetRequirementId)
  })

  return (
    <div className="space-y-2.5">
      <PageHeader
        title="Traceability Matrix"
        subtitle={`Filtered set: ${filtered.length} requirements. Paginated for usability up to 1,000 records.`}
        actions={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              downloadTextFile(
                `${project.metadata.name.replace(/\s+/g, '_')}_traceability_matrix.csv`,
                matrixToCsv(project, exportRows),
                'text/csv',
              )
            }
          >
            Export Matrix CSV
          </button>
        }
      />

      <FilterPanel />

      <div className="panel">
        <div className="panel-header">
          <h3>Relationship types</h3>
        </div>
        <div className="panel-body">
          <div className="flex flex-wrap gap-3">
            {RELATIONSHIP_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={matrixTypes.includes(type)}
                  onChange={(e) => {
                    if (e.target.checked) setMatrixTypes([...matrixTypes, type])
                    else setMatrixTypes(matrixTypes.filter((t) => t !== type))
                  }}
                />
                {type}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div>
          Columns page{' '}
          <button
            type="button"
            className="btn btn-secondary px-2 py-1"
            disabled={colPage <= 1}
            onClick={() => setColPage(colPage - 1)}
          >
            Prev
          </button>{' '}
          {colPage}/{colCount}{' '}
          <button
            type="button"
            className="btn btn-secondary px-2 py-1"
            disabled={colPage >= colCount}
            onClick={() => setColPage(colPage + 1)}
          >
            Next
          </button>
        </div>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        pageSize={25}
        urlStateKey="matrix"
        sizingStorageKey="matrix"
        enableColumnFilters={false}
        enableColumnVisibility={false}
        emptyMessage="No requirements match the current filters."
      />

      <p className="text-xs text-[var(--color-ink-muted)]">
        Abbreviations: P=Parent of, C=Child of, D=Derived from, S=Supports, Dep=Depends on, X=Conflicts with, Dup=Duplicates.
        Hover a cell for rationale.
      </p>
    </div>
  )
}

function abbreviate(type: RelationshipType): string {
  switch (type) {
    case 'Parent of':
      return 'P'
    case 'Child of':
      return 'C'
    case 'Derived from':
      return 'D'
    case 'Supports':
      return 'S'
    case 'Depends on':
      return 'Dep'
    case 'Conflicts with':
      return 'X'
    case 'Duplicates':
      return 'Dup'
  }
}
