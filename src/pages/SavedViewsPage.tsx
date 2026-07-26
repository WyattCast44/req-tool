import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore'
import { EmptyState } from '../components/EmptyState'
import { ConfirmDialog } from '../components/Modal'
import { useState } from 'react'
import { formatDateTime } from '../lib/ids'

export function SavedViewsPage() {
  const navigate = useNavigate()
  const project = useProjectStore((s) => s.project)!
  const mode = useProjectStore((s) => s.mode)
  const applySavedView = useProjectStore((s) => s.applySavedView)
  const upsertSavedView = useProjectStore((s) => s.upsertSavedView)
  const deleteSavedView = useProjectStore((s) => s.deleteSavedView)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Saved Views</h2>
          <p className="text-sm text-[var(--color-ink-muted)]">
            Named filter configurations stored in the project save file and shared with all users of that file.
          </p>
        </div>
        {mode === 'edit' && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const name = window.prompt('Name for saved view from current filters')
              if (!name?.trim()) return
              upsertSavedView({ name: name.trim() })
            }}
          >
            Save Current Filters as View
          </button>
        )}
      </div>

      {project.savedViews.length === 0 ? (
        <EmptyState title="No saved views" body="Create a saved view from the Requirements filters while in Edit Mode." />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Search</th>
                <th>Tag logic</th>
                <th>Modified</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {project.savedViews.map((view) => (
                <tr key={view.id}>
                  <td className="font-semibold">{view.name}</td>
                  <td>{view.searchQuery || '—'}</td>
                  <td>{view.tagLogic}</td>
                  <td>{formatDateTime(view.modifiedAt)}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="btn btn-secondary px-2 py-1 text-xs"
                        onClick={() => {
                          applySavedView(view.id)
                          navigate('/requirements')
                        }}
                      >
                        Apply
                      </button>
                      {mode === 'edit' && (
                        <>
                          <button
                            type="button"
                            className="btn btn-ghost px-2 py-1 text-xs"
                            onClick={() => {
                              const name = window.prompt('Rename view', view.name)
                              if (!name?.trim()) return
                              upsertSavedView({ ...view, name: name.trim() })
                            }}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost px-2 py-1 text-xs text-[var(--color-danger)]"
                            onClick={() => setDeleteId(view.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
