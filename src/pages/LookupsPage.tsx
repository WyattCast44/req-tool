import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ConfirmDialog } from '../components/Modal'
import { DataTable } from '../components/DataTable'
import { fuzzyIncludesFilter } from '../lib/tableFilters'
import { useProjectStore } from '../store/projectStore'
import type { LookupValue, Lookups, Tag, TagCategory } from '../types/project'

const LOOKUP_SECTIONS: { key: keyof Lookups; label: string }[] = [
  { key: 'statuses', label: 'Requirement statuses' },
  { key: 'types', label: 'Requirement types' },
  { key: 'classifications', label: 'Classifications' },
  { key: 'priorities', label: 'Priorities' },
  { key: 'verificationMethods', label: 'Verification methods' },
  { key: 'verificationStatuses', label: 'Verification statuses' },
  { key: 'assessmentResults', label: 'Assessment results' },
  { key: 'testActivityTypes', label: 'Test activity types' },
  { key: 'testPhases', label: 'Test phases' },
  { key: 'testActivityStatuses', label: 'Test activity statuses' },
  { key: 'evidenceTypes', label: 'Evidence types' },
]

interface LookupRow {
  id: string
  value: string
  active: string
  system: string
  sortOrder: number
  item: LookupValue
}

interface CategoryRow {
  id: string
  name: string
  active: string
  sortOrder: number
  tagCount: number
  category: TagCategory
}

interface TagRow {
  id: string
  name: string
  category: string
  categoryId: string
  active: string
  sortOrder: number
  tag: Tag
}

export function LookupsPage() {
  const project = useProjectStore((s) => s.project)!
  const mode = useProjectStore((s) => s.mode)
  const editing = mode === 'edit'
  const upsertLookup = useProjectStore((s) => s.upsertLookup)
  const deleteLookup = useProjectStore((s) => s.deleteLookup)
  const upsertTagCategory = useProjectStore((s) => s.upsertTagCategory)
  const deleteTagCategory = useProjectStore((s) => s.deleteTagCategory)
  const upsertTag = useProjectStore((s) => s.upsertTag)
  const deleteTag = useProjectStore((s) => s.deleteTag)
  const setToast = useProjectStore((s) => s.setToast)

  const [pendingDelete, setPendingDelete] = useState<null | {
    kind: 'lookup' | 'tag' | 'category'
    key?: keyof Lookups
    id: string
    label: string
  }>(null)

  const categoryRows = useMemo<CategoryRow[]>(
    () =>
      project.tagCategories
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((category) => ({
          id: category.id,
          name: category.name,
          active: category.active ? 'Active' : 'Inactive',
          sortOrder: category.sortOrder,
          tagCount: project.tags.filter((tag) => tag.categoryId === category.id).length,
          category,
        })),
    [project.tagCategories, project.tags],
  )

  const categoryColumns = useMemo<ColumnDef<CategoryRow>[]>(() => {
    const defs: ColumnDef<CategoryRow>[] = [
      {
        accessorKey: 'name',
        header: 'Category',
        cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.name, value),
        size: 220,
      },
      {
        accessorKey: 'active',
        header: 'Status',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.active, value),
        size: 110,
      },
      {
        accessorKey: 'tagCount',
        header: 'Tags',
        size: 80,
      },
      {
        accessorKey: 'sortOrder',
        header: 'Sort',
        enableColumnFilter: false,
        size: 80,
      },
    ]

    if (editing) {
      defs.push({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className="btn btn-ghost px-2 py-1 text-xs"
              onClick={() => {
                const name = window.prompt('Rename category', row.original.category.name)
                if (!name?.trim()) return
                upsertTagCategory({ ...row.original.category, name: name.trim() })
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className="btn btn-secondary px-2 py-1 text-xs"
              onClick={() => {
                const name = window.prompt('New tag name')
                if (!name?.trim()) return
                upsertTag({ name: name.trim(), categoryId: row.original.id })
              }}
            >
              Add Tag
            </button>
            <button
              type="button"
              className="btn btn-ghost px-2 py-1 text-xs text-[var(--color-danger)]"
              onClick={() =>
                setPendingDelete({ kind: 'category', id: row.original.id, label: row.original.name })
              }
            >
              Delete
            </button>
          </div>
        ),
        enableSorting: false,
        enableColumnFilter: false,
        enableHiding: false,
        size: 220,
      })
    }

    return defs
  }, [editing, upsertTag, upsertTagCategory])

  const tagRows = useMemo<TagRow[]>(
    () =>
      project.tags
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .map((tag) => {
          const category = project.tagCategories.find((item) => item.id === tag.categoryId)
          return {
            id: tag.id,
            name: tag.name,
            category: category?.name || 'Missing category',
            categoryId: tag.categoryId,
            active: tag.active ? 'Active' : 'Inactive',
            sortOrder: tag.sortOrder,
            tag,
          }
        }),
    [project.tagCategories, project.tags],
  )

  const tagColumns = useMemo<ColumnDef<TagRow>[]>(() => {
    const defs: ColumnDef<TagRow>[] = [
      {
        accessorKey: 'name',
        header: 'Tag',
        cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.name, value),
        size: 200,
      },
      {
        accessorKey: 'category',
        header: 'Category',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.category, value),
        size: 180,
      },
      {
        accessorKey: 'active',
        header: 'Status',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.active, value),
        size: 110,
      },
      {
        accessorKey: 'sortOrder',
        header: 'Sort',
        enableColumnFilter: false,
        size: 80,
      },
    ]

    if (editing) {
      defs.push({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex gap-1">
            <button
              type="button"
              className="btn btn-ghost px-2 py-1 text-xs"
              onClick={() => {
                const name = window.prompt('Rename tag', row.original.tag.name)
                if (!name?.trim()) return
                upsertTag({ ...row.original.tag, name: name.trim() })
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className="btn btn-ghost px-2 py-1 text-xs text-[var(--color-danger)]"
              onClick={() => setPendingDelete({ kind: 'tag', id: row.original.id, label: row.original.name })}
            >
              Delete
            </button>
          </div>
        ),
        enableSorting: false,
        enableColumnFilter: false,
        enableHiding: false,
        size: 140,
      })
    }

    return defs
  }, [editing, upsertTag])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="page-title">Lookups & Tags</h2>
        <p className="page-subtitle">
          {editing
            ? 'Manage controlled metadata. The application warns before changing values that are already assigned.'
            : 'Browse controlled metadata values. Enter Edit Mode to create, rename, or delete them.'}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {LOOKUP_SECTIONS.map((section) => (
          <LookupSectionTable
            key={section.key}
            sectionKey={section.key}
            label={section.label}
            items={project.lookups[section.key]}
            editing={editing}
            onAdd={() => {
              const value = window.prompt(`New ${section.label.slice(0, -1)} value`)
              if (!value?.trim()) return
              const result = upsertLookup(section.key, { value: value.trim() })
              if (result.warning) setToast(result.warning)
            }}
            onRename={(item) => {
              const value = window.prompt('Rename value', item.value)
              if (!value?.trim()) return
              const result = upsertLookup(section.key, { ...item, value: value.trim() })
              if (result.warning) setToast(result.warning)
            }}
            onToggleActive={(item) =>
              upsertLookup(section.key, { ...item, active: !item.active, value: item.value })
            }
            onDelete={(item) =>
              setPendingDelete({ kind: 'lookup', key: section.key, id: item.id, label: item.value })
            }
          />
        ))}

        <section className="panel p-4 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Tag categories</h3>
            {editing && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const name = window.prompt('New tag category name')
                  if (!name?.trim()) return
                  upsertTagCategory({ name: name.trim() })
                }}
              >
                Add Category
              </button>
            )}
          </div>
          {categoryRows.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-muted)]">No tag categories.</p>
          ) : (
            <DataTable
              data={categoryRows}
              columns={categoryColumns}
              getRowId={(row) => row.id}
              pageSize={25}
              maxHeightClassName="max-h-[40vh]"
              sizingStorageKey="lookup-tag-categories"
              emptyMessage="No categories match the current column filters."
            />
          )}
        </section>

        <section className="panel p-4 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Tags</h3>
            {editing && categoryRows.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const categoryName = window.prompt(
                    `Category for new tag (${categoryRows.map((row) => row.name).join(', ')})`,
                    categoryRows[0]?.name,
                  )
                  if (!categoryName?.trim()) return
                  const category = categoryRows.find(
                    (row) => row.name.toLowerCase() === categoryName.trim().toLowerCase(),
                  )
                  if (!category) {
                    setToast('Category not found. Create the category first, or type its exact name.')
                    return
                  }
                  const name = window.prompt('New tag name')
                  if (!name?.trim()) return
                  upsertTag({ name: name.trim(), categoryId: category.id })
                }}
              >
                Add Tag
              </button>
            )}
          </div>
          {tagRows.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-muted)]">No tags.</p>
          ) : (
            <DataTable
              data={tagRows}
              columns={tagColumns}
              getRowId={(row) => row.id}
              pageSize={50}
              maxHeightClassName="max-h-[50vh]"
              sizingStorageKey="lookup-tags"
              emptyMessage="No tags match the current column filters."
            />
          )}
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Confirm deletion"
        danger
        confirmLabel="Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return
          if (pendingDelete.kind === 'lookup' && pendingDelete.key) {
            const result = deleteLookup(pendingDelete.key, pendingDelete.id, 'block')
            if (!result.ok) {
              const others = project.lookups[pendingDelete.key].filter((x) => x.id !== pendingDelete.id)
              const reassignTo = others[0]?.id
              if (!reassignTo) {
                setToast(result.message || 'Cannot delete the last lookup value.')
              } else if (
                window.confirm(
                  `${result.message} Reassign existing records to "${others[0].value}" and delete?`,
                )
              ) {
                deleteLookup(pendingDelete.key, pendingDelete.id, 'reassign', reassignTo)
              }
            }
          } else if (pendingDelete.kind === 'tag') {
            const result = deleteTag(pendingDelete.id, 'block')
            if (!result.ok) {
              if (window.confirm(`${result.message} Clear assignments and delete?`)) {
                deleteTag(pendingDelete.id, 'clear')
              }
            }
          } else if (pendingDelete.kind === 'category') {
            const result = deleteTagCategory(pendingDelete.id, 'block')
            if (!result.ok) {
              if (window.confirm(`${result.message} Clear tag assignments and delete category/tags?`)) {
                deleteTagCategory(pendingDelete.id, 'clear')
              }
            }
          }
          setPendingDelete(null)
        }}
        message={
          <p>
            Delete <strong>{pendingDelete?.label}</strong>? If the value is in use, you will be asked how to handle
            existing assignments.
          </p>
        }
      />
    </div>
  )
}

function LookupSectionTable({
  sectionKey,
  label,
  items,
  editing,
  onAdd,
  onRename,
  onToggleActive,
  onDelete,
}: {
  sectionKey: keyof Lookups
  label: string
  items: LookupValue[]
  editing: boolean
  onAdd: () => void
  onRename: (item: LookupValue) => void
  onToggleActive: (item: LookupValue) => void
  onDelete: (item: LookupValue) => void
}) {
  const rows = useMemo<LookupRow[]>(
    () =>
      items
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => ({
          id: item.id,
          value: item.value,
          active: item.active ? 'Active' : 'Inactive',
          system: item.system ? 'Default' : '',
          sortOrder: item.sortOrder,
          item,
        })),
    [items],
  )

  const columns = useMemo<ColumnDef<LookupRow>[]>(() => {
    const defs: ColumnDef<LookupRow>[] = [
      {
        accessorKey: 'value',
        header: 'Value',
        cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.value, value),
        size: 240,
      },
      {
        accessorKey: 'active',
        header: 'Status',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.active, value),
        size: 110,
      },
      {
        accessorKey: 'system',
        header: 'Origin',
        cell: ({ getValue }) => getValue<string>() || '—',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.system || 'Custom', value),
        size: 100,
      },
      {
        accessorKey: 'sortOrder',
        header: 'Sort',
        enableColumnFilter: false,
        size: 80,
      },
    ]

    if (editing) {
      defs.push({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className="btn btn-ghost px-2 py-1 text-xs"
              onClick={() => onRename(row.original.item)}
            >
              Rename
            </button>
            <button
              type="button"
              className="btn btn-ghost px-2 py-1 text-xs"
              onClick={() => onToggleActive(row.original.item)}
            >
              {row.original.item.active ? 'Deactivate' : 'Activate'}
            </button>
            <button
              type="button"
              className="btn btn-ghost px-2 py-1 text-xs text-[var(--color-danger)]"
              onClick={() => onDelete(row.original.item)}
            >
              Delete
            </button>
          </div>
        ),
        enableSorting: false,
        enableColumnFilter: false,
        enableHiding: false,
        size: 220,
      })
    }

    return defs
  }, [editing, onDelete, onRename, onToggleActive])

  return (
    <section className="panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{label}</h3>
        {editing && (
          <button type="button" className="btn btn-secondary" onClick={onAdd}>
            Add
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-muted)]">No values.</p>
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          getRowId={(row) => row.id}
          pageSize={25}
          maxHeightClassName="max-h-[40vh]"
          sizingStorageKey={`lookups-${sectionKey}`}
          emptyMessage="No values match the current column filters."
        />
      )}
    </section>
  )
}
