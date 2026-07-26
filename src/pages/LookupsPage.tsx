import { useState } from 'react'
import { useProjectStore } from '../store/projectStore'
import type { Lookups } from '../types/project'
import { ConfirmDialog } from '../components/Modal'

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

  if (!editing) {
    return (
      <div className="space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Lookups & Tags</h2>
        <div className="panel p-4 text-sm">
          Lookup and tag management is available only in Edit Mode. Enter Edit Mode to create, rename, or delete
          controlled values.
        </div>
        <ReadOnlyLists />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Lookups & Tags</h2>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Manage controlled metadata. The application warns before changing values that are already assigned.
        </p>
      </div>

      {LOOKUP_SECTIONS.map((section) => (
        <section key={section.key} className="panel p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-semibold">{section.label}</h3>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                const value = window.prompt(`New ${section.label.slice(0, -1)} value`)
                if (!value?.trim()) return
                const result = upsertLookup(section.key, { value: value.trim() })
                if (result.warning) setToast(result.warning)
              }}
            >
              Add
            </button>
          </div>
          <ul className="divide-y divide-[var(--color-line)]">
            {project.lookups[section.key]
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <span className="font-medium">{item.value}</span>
                    {!item.active && <span className="ml-2 badge border-slate-300">Inactive</span>}
                    {item.system && <span className="ml-2 text-xs text-[var(--color-ink-muted)]">default</span>}
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="btn btn-ghost px-2 py-1 text-xs"
                      onClick={() => {
                        const value = window.prompt('Rename value', item.value)
                        if (!value?.trim()) return
                        const result = upsertLookup(section.key, { ...item, value: value.trim() })
                        if (result.warning) setToast(result.warning)
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost px-2 py-1 text-xs"
                      onClick={() => upsertLookup(section.key, { ...item, active: !item.active, value: item.value })}
                    >
                      {item.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost px-2 py-1 text-xs text-[var(--color-danger)]"
                      onClick={() =>
                        setPendingDelete({ kind: 'lookup', key: section.key, id: item.id, label: item.value })
                      }
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}

      <section className="panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Tag categories & tags</h3>
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
        </div>
        <div className="space-y-4">
          {project.tagCategories
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((cat) => (
              <div key={cat.id} className="rounded-md border border-[var(--color-line)] p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">{cat.name}</div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="btn btn-ghost px-2 py-1 text-xs"
                      onClick={() => {
                        const name = window.prompt('Rename category', cat.name)
                        if (!name?.trim()) return
                        upsertTagCategory({ ...cat, name: name.trim() })
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
                        upsertTag({ name: name.trim(), categoryId: cat.id })
                      }}
                    >
                      Add Tag
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost px-2 py-1 text-xs text-[var(--color-danger)]"
                      onClick={() => setPendingDelete({ kind: 'category', id: cat.id, label: cat.name })}
                    >
                      Delete Category
                    </button>
                  </div>
                </div>
                <ul className="space-y-1">
                  {project.tags
                    .filter((t) => t.categoryId === cat.id)
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((tag) => (
                      <li key={tag.id} className="flex items-center justify-between text-sm">
                        <span>
                          {tag.name}
                          {!tag.active && <span className="ml-2 badge border-slate-300">Inactive</span>}
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="btn btn-ghost px-2 py-1 text-xs"
                            onClick={() => {
                              const name = window.prompt('Rename tag', tag.name)
                              if (!name?.trim()) return
                              upsertTag({ ...tag, name: name.trim() })
                            }}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost px-2 py-1 text-xs text-[var(--color-danger)]"
                            onClick={() => setPendingDelete({ kind: 'tag', id: tag.id, label: tag.name })}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
        </div>
      </section>

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

function ReadOnlyLists() {
  const project = useProjectStore((s) => s.project)!
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {LOOKUP_SECTIONS.map((section) => (
        <section key={section.key} className="panel p-4">
          <h3 className="mb-2 font-semibold">{section.label}</h3>
          <ul className="list-disc pl-5 text-sm">
            {project.lookups[section.key].map((item) => (
              <li key={item.id}>
                {item.value}
                {!item.active ? ' (inactive)' : ''}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="panel p-4 lg:col-span-2">
        <h3 className="mb-2 font-semibold">Tags</h3>
        {project.tagCategories.map((cat) => (
          <div key={cat.id} className="mb-3">
            <div className="font-medium">{cat.name}</div>
            <div className="text-sm text-[var(--color-ink-muted)]">
              {project.tags
                .filter((t) => t.categoryId === cat.id)
                .map((t) => t.name)
                .join(', ') || '—'}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
