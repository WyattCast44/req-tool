import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../components/DataTable'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { WatchItemStatusBadge } from '../components/StatusBadge'
import { indexById } from '../lib/collections'
import { formatDateTime } from '../lib/ids'
import { fuzzyIncludesFilter, plainTextFromHtml } from '../lib/tableFilters'
import { useTableUrlState } from '../lib/urlState'
import { useProjectStore } from '../store/projectStore'
import {
  WATCH_ITEM_STATUSES,
  type WatchItem,
  type WatchItemStatus,
} from '../types/project'

interface WatchItemRow {
  id: string
  title: string
  description: string
  status: WatchItem['status']
  observations: string
  observationCount: number
  requirements: string
  sources: string
  modifiedAt: string
  modifiedAtRaw: string
  editorName: string
}

const TABLE_KEY = 'watch-items'

export function WatchItemsPage() {
  const navigate = useNavigate()
  const project = useProjectStore((state) => state.project)!
  const editing = useProjectStore((state) => state.mode === 'edit')
  const { columnFilters, setColumnFilters } = useTableUrlState(TABLE_KEY, { pageSize: 100 })

  const activeStatus = useMemo(() => {
    const value = columnFilters.find((filter) => filter.id === 'status')?.value
    return typeof value === 'string' && (WATCH_ITEM_STATUSES as readonly string[]).includes(value)
      ? (value as WatchItem['status'])
      : null
  }, [columnFilters])

  const toggleStatusFilter = (status: WatchItem['status']) => {
    const withoutStatus = columnFilters.filter((filter) => filter.id !== 'status')
    setColumnFilters(
      activeStatus === status ? withoutStatus : [...withoutStatus, { id: 'status', value: status }],
    )
  }

  const requirementsById = useMemo(
    () => indexById(project.requirements),
    [project.requirements],
  )
  const sourcesById = useMemo(() => indexById(project.sources), [project.sources])

  const rows = useMemo<WatchItemRow[]>(
    () =>
      project.watchItems
        .map((watchItem) => ({
          id: watchItem.id,
          title: watchItem.title,
          description: plainTextFromHtml(watchItem.description),
          status: watchItem.status,
          observations: watchItem.observations
            .map((observation) => plainTextFromHtml(observation.text))
            .join(' '),
          observationCount: watchItem.observations.length,
          requirements: watchItem.requirementIds
            .map((id) => requirementsById.get(id)?.sourceId)
            .filter(Boolean)
            .join(', '),
          sources: watchItem.sourceIds
            .map((id) => {
              const source = sourcesById.get(id)
              return source?.identifier || source?.title
            })
            .filter(Boolean)
            .join(', '),
          modifiedAt: formatDateTime(watchItem.modifiedAt),
          modifiedAtRaw: watchItem.modifiedAt,
          editorName: watchItem.editorName,
        }))
        .sort((a, b) => b.modifiedAtRaw.localeCompare(a.modifiedAtRaw)),
    [project.watchItems, requirementsById, sourcesById],
  )

  const statusCounts = useMemo<Record<WatchItemStatus, number>>(() => {
    const counts: Record<WatchItemStatus, number> = {
      Open: 0,
      Monitoring: 0,
      Resolved: 0,
      Closed: 0,
    }
    for (const watchItem of project.watchItems) counts[watchItem.status] += 1
    return counts
  }, [project.watchItems])

  const columns = useMemo<ColumnDef<WatchItemRow>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Watch Item',
        cell: ({ row }) => (
          <Link
            className="font-semibold text-[var(--color-accent)] hover:underline"
            to={`/watch-items/${row.original.id}`}
          >
            {row.original.title}
          </Link>
        ),
        filterFn: (row, _id, value) =>
          fuzzyIncludesFilter(
            `${row.original.title} ${row.original.description} ${row.original.observations}`,
            value,
          ),
        size: 260,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => <WatchItemStatusBadge value={getValue<WatchItem['status']>()} />,
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.status, value),
        size: 120,
      },
      {
        accessorKey: 'observationCount',
        header: 'Observations',
        size: 110,
      },
      {
        accessorKey: 'requirements',
        header: 'Requirements',
        cell: ({ getValue }) => getValue<string>() || '—',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.requirements, value),
        size: 180,
      },
      {
        accessorKey: 'sources',
        header: 'Sources',
        cell: ({ getValue }) => getValue<string>() || '—',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.sources, value),
        size: 160,
      },
      {
        accessorKey: 'modifiedAt',
        header: 'Modified',
        sortingFn: (a, b) => a.original.modifiedAtRaw.localeCompare(b.original.modifiedAtRaw),
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.modifiedAt, value),
        size: 155,
      },
      {
        accessorKey: 'editorName',
        header: 'Editor',
        cell: ({ getValue }) => getValue<string>() || '—',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.editorName, value),
        size: 120,
      },
    ],
    [],
  )

  return (
    <div className="space-y-2.5">
      <PageHeader
        title="Watch Items"
        subtitle="Standalone topics under observation, optionally linked to requirements and sources."
        actions={
          editing ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/watch-items/new')}
            >
              New Watch Item
            </button>
          ) : undefined
        }
      />

      <section className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {WATCH_ITEM_STATUSES.map((status) => {
          const active = activeStatus === status
          return (
            <button
              key={status}
              type="button"
              className="stat-tile text-left"
              aria-pressed={active}
              title={active ? `Clear ${status} filter` : `Filter by ${status}`}
              onClick={() => toggleStatusFilter(status)}
            >
              <div className="stat-value">{statusCounts[status]}</div>
              <div className="stat-label">{status}</div>
            </button>
          )
        })}
      </section>

      {rows.length === 0 ? (
        <EmptyState
          title="No watch items"
          body="Create a watch item to track a topic and its observations. Requirement and source links are optional."
          action={
            editing ? (
              <Link className="btn btn-primary" to="/watch-items/new">
                Create Watch Item
              </Link>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          getRowId={(row) => row.id}
          pageSize={100}
          urlStateKey={TABLE_KEY}
          sizingStorageKey="watch-items"
          emptyMessage="No watch items match the current column filters."
        />
      )}
    </div>
  )
}
