import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { useProjectStore } from '../store/projectStore'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { ConfirmDialog } from '../components/Modal'
import { DataTable } from '../components/DataTable'
import { fuzzyIncludesFilter } from '../lib/tableFilters'
import { formatDateTime } from '../lib/ids'
import type { SavedView } from '../types/project'
import { savedViewSearch } from '../lib/urlState'

interface ViewRow {
  id: string
  name: string
  searchQuery: string
  tagLogic: string
  modifiedAt: string
  modifiedAtRaw: string
  view: SavedView
}

export function SavedViewsPage() {
  const navigate = useNavigate()
  const project = useProjectStore((s) => s.project)!
  const mode = useProjectStore((s) => s.mode)
  const upsertSavedView = useProjectStore((s) => s.upsertSavedView)
  const deleteSavedView = useProjectStore((s) => s.deleteSavedView)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const rows = useMemo<ViewRow[]>(
    () =>
      project.savedViews.map((view) => ({
        id: view.id,
        name: view.name,
        searchQuery: view.searchQuery || '',
        tagLogic: view.tagLogic,
        modifiedAt: formatDateTime(view.modifiedAt),
        modifiedAtRaw: view.modifiedAt,
        view,
      })),
    [project.savedViews],
  )

  const columns = useMemo<ColumnDef<ViewRow>[]>(() => {
    const defs: ColumnDef<ViewRow>[] = [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ getValue }) => <span className="font-semibold">{getValue<string>()}</span>,
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.name, value),
        size: 200,
      },
      {
        accessorKey: 'searchQuery',
        header: 'Search',
        cell: ({ getValue }) => getValue<string>() || '—',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.searchQuery, value),
        size: 180,
      },
      {
        accessorKey: 'tagLogic',
        header: 'Tag logic',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.tagLogic, value),
        size: 100,
      },
      {
        accessorKey: 'modifiedAt',
        header: 'Modified',
        sortingFn: (a, b) => a.original.modifiedAtRaw.localeCompare(b.original.modifiedAtRaw),
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.modifiedAt, value),
        size: 160,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className="btn btn-secondary px-1.5 py-0.5 text-[0.68rem]"
              onClick={() => {
                navigate(`/requirements${savedViewSearch(row.original.view)}`)
              }}
            >
              Apply
            </button>
            {mode === 'edit' && (
              <>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const name = window.prompt('Rename view', row.original.name)
                    if (!name?.trim()) return
                    upsertSavedView({ ...row.original.view, name: name.trim() })
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-ghost-danger"
                  onClick={() => setDeleteId(row.original.id)}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        ),
        enableSorting: false,
        enableColumnFilter: false,
        enableHiding: false,
        size: 180,
      },
    ]
    return defs
  }, [mode, navigate, upsertSavedView])

  return (
    <div className="space-y-2.5">
      <PageHeader
        title="Saved Views"
        subtitle="Named filter configurations stored in the project save file and shared with all users of that file."
      />

      {project.savedViews.length === 0 ? (
        <EmptyState title="No saved views" body="Create a saved view from the Requirements filters while in Edit Mode." />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          getRowId={(row) => row.id}
          pageSize={50}
          urlStateKey=""
          sizingStorageKey="saved-views"
          emptyMessage="No saved views match the current column filters."
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete saved view?"
        danger
        confirmLabel="Delete"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteSavedView(deleteId)
          setDeleteId(null)
        }}
        message={<p>Remove this saved filter configuration from the project database?</p>}
      />
    </div>
  )
}
