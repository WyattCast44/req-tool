import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnSizingState,
  type OnChangeFn,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

export type { ColumnDef, VisibilityState, SortingState }

interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  getRowId: (row: T) => string
  pageSize?: number
  maxHeightClassName?: string
  emptyMessage?: string
  /** Controlled column visibility. When omitted, managed internally. */
  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>
  /** Controlled sorting. When omitted, managed internally. */
  sorting?: SortingState
  onSortingChange?: OnChangeFn<SortingState>
  enableRowSelection?: boolean
  rowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  /** Persist column widths in localStorage under this key. */
  sizingStorageKey?: string
  toolbarLeft?: ReactNode
  className?: string
}

function loadSizing(key?: string): ColumnSizingState {
  if (!key) return {}
  try {
    const raw = localStorage.getItem(`otreq-colsize:${key}`)
    if (!raw) return {}
    return JSON.parse(raw) as ColumnSizingState
  } catch {
    return {}
  }
}

export function DataTable<T>({
  data,
  columns,
  getRowId,
  pageSize = 100,
  maxHeightClassName = 'max-h-[70vh]',
  emptyMessage = 'No rows to display.',
  columnVisibility,
  onColumnVisibilityChange,
  sorting: controlledSorting,
  onSortingChange,
  enableRowSelection = false,
  rowSelection: controlledSelection,
  onRowSelectionChange,
  sizingStorageKey,
  toolbarLeft,
  className = '',
}: DataTableProps<T>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [internalVisibility, setInternalVisibility] = useState<VisibilityState>({})
  const [internalSelection, setInternalSelection] = useState<RowSelectionState>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => loadSizing(sizingStorageKey))
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize })
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [showColumnFilters, setShowColumnFilters] = useState(false)

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageSize, pageIndex: 0 }))
  }, [pageSize, data])

  useEffect(() => {
    if (!sizingStorageKey) return
    try {
      localStorage.setItem(`otreq-colsize:${sizingStorageKey}`, JSON.stringify(columnSizing))
    } catch {
      // ignore quota / private mode
    }
  }, [columnSizing, sizingStorageKey])

  const sorting = controlledSorting ?? internalSorting
  const setSorting = onSortingChange ?? setInternalSorting
  const visibility = columnVisibility ?? internalVisibility
  const setVisibility = onColumnVisibilityChange ?? setInternalVisibility
  const rowSelection = controlledSelection ?? internalSelection
  const setRowSelection = onRowSelectionChange ?? setInternalSelection

  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => getRowId(row),
    state: {
      sorting,
      columnFilters,
      columnVisibility: visibility,
      rowSelection,
      columnSizing,
      pagination,
    },
    enableRowSelection,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: setColumnSizing,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    defaultColumn: {
      minSize: 60,
      size: 140,
      maxSize: 640,
      enableSorting: true,
      enableColumnFilter: true,
      enableResizing: true,
    },
  })

  const hideableColumns = useMemo(
    () => table.getAllLeafColumns().filter((col) => col.getCanHide() && col.id !== 'select' && col.id !== 'actions'),
    [table],
  )

  const filteredCount = table.getFilteredRowModel().rows.length
  const pageCount = table.getPageCount()
  const pageIndex = table.getState().pagination.pageIndex
  const activeColumnFilterCount = columnFilters.filter((f) => {
    if (typeof f.value === 'string') return f.value.trim().length > 0
    return f.value != null && f.value !== ''
  }).length

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {toolbarLeft}
          <span className="text-[0.72rem] text-[var(--color-ink-muted)]">
            {filteredCount} row{filteredCount === 1 ? '' : 's'}
            {filteredCount !== data.length ? ` (of ${data.length})` : ''}
            {activeColumnFilterCount > 0
              ? ` · ${activeColumnFilterCount} column filter${activeColumnFilterCount === 1 ? '' : 's'}`
              : ''}
            {enableRowSelection && Object.keys(rowSelection).length > 0
              ? ` · ${Object.keys(rowSelection).length} selected`
              : ''}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={`btn ${showColumnFilters || activeColumnFilterCount > 0 ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowColumnFilters((v) => !v)}
          >
            {showColumnFilters ? 'Hide Filters' : 'Column Filters'}
            {activeColumnFilterCount > 0 ? ` (${activeColumnFilterCount})` : ''}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setColumnsOpen((v) => !v)}>
            Columns
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            title="Reset column filters, sorting, and column widths only. List/field filters above are unchanged."
            onClick={() => {
              setColumnFilters([])
              setSorting([])
              if (sizingStorageKey) {
                setColumnSizing({})
                try {
                  localStorage.removeItem(`otreq-colsize:${sizingStorageKey}`)
                } catch {
                  // ignore
                }
              }
            }}
          >
            Reset Columns
          </button>
        </div>
      </div>

      {columnsOpen && (
        <div className="panel grid gap-1.5 p-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {hideableColumns.map((column) => (
            <label key={column.id} className="flex items-center gap-1.5 text-[0.75rem]">
              <input
                type="checkbox"
                checked={column.getIsVisible()}
                onChange={column.getToggleVisibilityHandler()}
              />
              {typeof column.columnDef.header === 'string'
                ? column.columnDef.header
                : column.id}
            </label>
          ))}
        </div>
      )}

      {filteredCount === 0 ? (
        <div className="panel px-3 py-6 text-[0.78rem] text-[var(--color-ink-muted)]">{emptyMessage}</div>
      ) : (
        <>
          <div className={`table-wrap ${maxHeightClassName}`}>
            <table
              className="data-table data-table-resizable"
              style={{ width: table.getCenterTotalSize() }}
            >
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        style={{ width: header.getSize(), position: 'relative' }}
                        className={header.column.getCanSort() ? 'select-none' : undefined}
                      >
                        {header.isPlaceholder ? null : (
                          <div className="flex flex-col gap-0.5">
                            {header.column.getCanSort() ? (
                              <button
                                type="button"
                                className="header-sort-btn sortable"
                                onClick={header.column.getToggleSortingHandler()}
                              >
                                <span>
                                  {flexRender(header.column.columnDef.header, header.getContext())}
                                </span>
                                {{
                                  asc: ' ↑',
                                  desc: ' ↓',
                                }[header.column.getIsSorted() as string] ?? ' ↕'}
                              </button>
                            ) : (
                              <div className="header-sort-btn">
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </div>
                            )}
                            {showColumnFilters && header.column.getCanFilter() && (
                              <input
                                className="field-input column-filter-input"
                                value={(header.column.getFilterValue() as string) ?? ''}
                                placeholder="Filter…"
                                onChange={(e) => header.column.setFilterValue(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                          </div>
                        )}
                        {header.column.getCanResize() && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={`col-resizer ${header.column.getIsResizing() ? 'is-resizing' : ''}`}
                            role="separator"
                            aria-orientation="vertical"
                            aria-label={`Resize ${header.id}`}
                          />
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className={row.getIsSelected() ? 'selected' : undefined}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} style={{ width: cell.column.getSize() }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[0.72rem]">
            <div className="flex items-center gap-2">
              <span>
                Page {pageCount === 0 ? 0 : pageIndex + 1} of {Math.max(pageCount, 1)}
              </span>
              <label className="flex items-center gap-1">
                <span className="text-[var(--color-ink-muted)]">Rows</span>
                <select
                  className="field-input w-auto py-0.5"
                  value={pagination.pageSize}
                  onChange={(e) => table.setPageSize(Number(e.target.value))}
                >
                  {[25, 50, 100, 200, 500].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
