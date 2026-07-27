import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../components/DataTable'
import { EmptyState } from '../components/EmptyState'
import { fuzzyIncludesFilter } from '../lib/tableFilters'
import { formatDateTime } from '../lib/ids'
import { countDistinctLinkedRequirements } from '../lib/sourceLinks'
import { useProjectStore } from '../store/projectStore'
import type { Source } from '../types/project'

interface SourceRow {
  id: string
  identifier: string
  title: string
  sourceType: string
  version: string
  publisher: string
  linkedRequirements: number
  modifiedAt: string
  source: Source
}

export function SourcesPage() {
  const project = useProjectStore((state) => state.project)!
  const editing = useProjectStore((state) => state.mode === 'edit')

  const rows = useMemo<SourceRow[]>(
    () =>
      (project.sources ?? []).map((source) => ({
        id: source.id,
        identifier: source.identifier,
        title: source.title,
        sourceType: source.sourceType,
        version: source.version,
        publisher: source.publisher,
        linkedRequirements: countDistinctLinkedRequirements(
          project.requirementSourceLinks,
          source.id,
        ),
        modifiedAt: source.modifiedAt,
        source,
      })),
    [project],
  )

  const columns = useMemo<ColumnDef<SourceRow>[]>(
    () => [
      {
        accessorKey: 'identifier',
        header: 'Identifier',
        cell: ({ row }) => (
          <Link className="mono font-semibold text-[var(--color-accent)] hover:underline" to={`/sources/${row.original.id}`}>
            {row.original.identifier || '—'}
          </Link>
        ),
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.identifier, value),
        size: 150,
      },
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ row }) => (
          <Link className="font-semibold text-[var(--color-accent)] hover:underline" to={`/sources/${row.original.id}`}>
            {row.original.title}
          </Link>
        ),
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.title, value),
        size: 280,
      },
      {
        accessorKey: 'sourceType',
        header: 'Type',
        cell: ({ getValue }) => getValue<string>() || '—',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.sourceType, value),
        size: 130,
      },
      {
        accessorKey: 'version',
        header: 'Version',
        cell: ({ getValue }) => getValue<string>() || '—',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.version, value),
        size: 100,
      },
      {
        accessorKey: 'publisher',
        header: 'Publisher / owner',
        cell: ({ getValue }) => getValue<string>() || '—',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.publisher, value),
        size: 180,
      },
      {
        accessorKey: 'linkedRequirements',
        header: 'Requirements',
        size: 110,
      },
      {
        accessorKey: 'modifiedAt',
        header: 'Modified',
        cell: ({ getValue }) => formatDateTime(getValue<string>()),
        enableColumnFilter: false,
        size: 170,
      },
    ],
    [],
  )

  return (
    <div className="space-y-2.5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Sources</h2>
          <p className="page-subtitle">
            Reusable documents, policies, standards, interviews, and other origins linked to requirements.
          </p>
        </div>
        {editing && (
          <Link className="btn btn-primary" to="/sources/new">
            New Source
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No sources configured"
          body="Create a source in Edit Mode, then connect it to requirements with a typed relationship, locator, rationale, and notes."
          action={
            editing ? (
              <Link className="btn btn-primary" to="/sources/new">
                Create Source
              </Link>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          getRowId={(row) => row.id}
          pageSize={50}
          urlStateKey=""
          sizingStorageKey="sources"
          emptyMessage="No sources match the current column filters."
        />
      )}
    </div>
  )
}
