import { useState } from 'react'
import { useProjectStore } from '../store/projectStore'
import { RichTextEditor, RichTextView } from '../components/RichText'
import { ConfirmDialog, Modal } from '../components/Modal'
import { lookupLabel } from '../lib/defaults'
import { formatDate } from '../lib/ids'
import type { TestActivity } from '../types/project'
import { EmptyState } from '../components/EmptyState'
import { Link } from 'react-router-dom'

const blank = (): Partial<TestActivity> & { title: string } => ({
  title: '',
  typeId: '',
  phaseId: '',
  plannedStart: '',
  plannedEnd: '',
  actualStart: '',
  actualEnd: '',
  owner: '',
  statusId: '',
  objectives: '',
  dataSources: '',
  notes: '',
})

export function ActivitiesPage() {
  const project = useProjectStore((s) => s.project)!
  const mode = useProjectStore((s) => s.mode)
  const editing = mode === 'edit'
  const upsertTestActivity = useProjectStore((s) => s.upsertTestActivity)
  const deleteTestActivity = useProjectStore((s) => s.deleteTestActivity)

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Partial<TestActivity> & { title: string }>(blank())
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const openCreate = () => {
    setDraft({
      ...blank(),
      typeId: project.lookups.testActivityTypes[0]?.id || '',
      phaseId: project.lookups.testPhases[0]?.id || '',
      statusId: project.lookups.testActivityStatuses[0]?.id || '',
    })
    setOpen(true)
  }

  const openEdit = (activity: TestActivity) => {
    setDraft({ ...activity })
    setOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Test Activities</h2>
          <p className="text-sm text-[var(--color-ink-muted)]">
            Reusable activities that can be linked to multiple requirements.
          </p>
        </div>
        {editing && (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            New Test Activity
          </button>
        )}
      </div>

      {project.testActivities.length === 0 ? (
        <EmptyState
          title="No test activities"
          body="Create reusable planned test activities in Edit Mode, then link them from requirement detail."
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Phase</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Planned</th>
                <th>Linked Reqs</th>
                {editing && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {project.testActivities.map((activity) => {
                const links = project.requirementActivityLinks.filter((l) => l.testActivityId === activity.id)
                return (
                  <tr key={activity.id}>
                    <td className="font-semibold">{activity.title}</td>
                    <td>{lookupLabel(project.lookups.testActivityTypes, activity.typeId)}</td>
                    <td>{lookupLabel(project.lookups.testPhases, activity.phaseId)}</td>
                    <td>{lookupLabel(project.lookups.testActivityStatuses, activity.statusId)}</td>
                    <td>{activity.owner || '—'}</td>
                    <td>
                      {formatDate(activity.plannedStart)} – {formatDate(activity.plannedEnd)}
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        {links.length === 0 && '—'}
                        {links.map((link) => {
                          const req = project.requirements.find((r) => r.id === link.requirementId)
                          return req ? (
                            <Link key={link.id} className="text-[var(--color-accent)] hover:underline" to={`/requirements/${req.id}`}>
                              {req.sourceId}
                            </Link>
                          ) : (
                            <span key={link.id}>Missing</span>
                          )
                        })}
                      </div>
                    </td>
                    {editing && (
                      <td>
                        <div className="flex gap-1">
                          <button type="button" className="btn btn-ghost px-2 py-1 text-xs" onClick={() => openEdit(activity)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost px-2 py-1 text-xs text-[var(--color-danger)]"
                            onClick={() => setDeleteId(activity.id)}
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
      )}

      <Modal
        open={open}
        title={draft.id ? 'Edit Test Activity' : 'New Test Activity'}
        wide
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (!draft.title.trim()) {
                  window.alert('Test-activity title is required.')
                  return
                }
                upsertTestActivity(draft, project.metadata.editorNameDefault)
                setOpen(false)
              }}
            >
              Save
            </button>
          </>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="field-label">Title *</span>
            <input className="field-input" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
          </label>
          <label>
            <span className="field-label">Type</span>
            <select className="field-input" value={draft.typeId || ''} onChange={(e) => setDraft((d) => ({ ...d, typeId: e.target.value }))}>
              {project.lookups.testActivityTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.value}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Phase</span>
            <select className="field-input" value={draft.phaseId || ''} onChange={(e) => setDraft((d) => ({ ...d, phaseId: e.target.value }))}>
              {project.lookups.testPhases.map((t) => (
                <option key={t.id} value={t.id}>{t.value}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Status</span>
            <select className="field-input" value={draft.statusId || ''} onChange={(e) => setDraft((d) => ({ ...d, statusId: e.target.value }))}>
              {project.lookups.testActivityStatuses.map((t) => (
                <option key={t.id} value={t.id}>{t.value}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Owner</span>
            <input className="field-input" value={draft.owner || ''} onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))} />
          </label>
          <label>
            <span className="field-label">Planned start</span>
            <input type="date" className="field-input" value={draft.plannedStart || ''} onChange={(e) => setDraft((d) => ({ ...d, plannedStart: e.target.value }))} />
          </label>
          <label>
            <span className="field-label">Planned end</span>
            <input type="date" className="field-input" value={draft.plannedEnd || ''} onChange={(e) => setDraft((d) => ({ ...d, plannedEnd: e.target.value }))} />
          </label>
          <label>
            <span className="field-label">Actual start</span>
            <input type="date" className="field-input" value={draft.actualStart || ''} onChange={(e) => setDraft((d) => ({ ...d, actualStart: e.target.value }))} />
          </label>
          <label>
            <span className="field-label">Actual end</span>
            <input type="date" className="field-input" value={draft.actualEnd || ''} onChange={(e) => setDraft((d) => ({ ...d, actualEnd: e.target.value }))} />
          </label>
          <div className="md:col-span-2">
            <span className="field-label">Objectives</span>
            <RichTextEditor value={draft.objectives || ''} onChange={(html) => setDraft((d) => ({ ...d, objectives: html }))} />
          </div>
          <div className="md:col-span-2">
            <span className="field-label">Data sources</span>
            <RichTextEditor value={draft.dataSources || ''} onChange={(html) => setDraft((d) => ({ ...d, dataSources: html }))} />
          </div>
          <div className="md:col-span-2">
            <span className="field-label">Notes</span>
            <RichTextEditor value={draft.notes || ''} onChange={(html) => setDraft((d) => ({ ...d, notes: html }))} />
          </div>
          {draft.id && (
            <div className="md:col-span-2 text-sm">
              <div className="field-label">Preview</div>
              <RichTextView html={draft.objectives || ''} />
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete test activity?"
        danger
        confirmLabel="Delete Permanently"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteTestActivity(deleteId)
          setDeleteId(null)
        }}
        message={
          <div>
            <p>This will permanently delete the activity and remove requirement links. Related verifications/assessments will unlink the activity.</p>
          </div>
        }
      />
    </div>
  )
}
