import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { useProjectStore } from '../store/projectStore'
import { RichTextEditor, RichTextView } from '../components/RichText'
import { ConfirmDialog, Modal } from '../components/Modal'
import { DataTable } from '../components/DataTable'
import { fuzzyIncludesFilter } from '../lib/tableFilters'
import { lookupLabel } from '../lib/defaults'
import { formatDate } from '../lib/ids'
import type { TestActivity } from '../types/project'
import { EmptyState } from '../components/EmptyState'

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

interface ActivityRow {
  id: string
  title: string
  type: string
  phase: string
  status: string
  owner: string
  planned: string
  linkedLabels: string
  linkedIds: string[]
  activity: TestActivity
}

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

  const rows = useMemo<ActivityRow[]>(
    () =>
      project.testActivities.map((activity) => {
        const links = project.requirementActivityLinks.filter((l) => l.testActivityId === activity.id)
        const linkedIds = links
          .map((link) => project.requirements.find((r) => r.id === link.requirementId)?.id)
          .filter(Boolean) as string[]
        const linkedLabels = links
          .map((link) => project.requirements.find((r) => r.id === link.requirementId)?.sourceId)
          .filter(Boolean)
          .join(', ')
        return {
          id: activity.id,
          title: activity.title,
          type: lookupLabel(project.lookups.testActivityTypes, activity.typeId),
          phase: lookupLabel(project.lookups.testPhases, activity.phaseId),
          status: lookupLabel(project.lookups.testActivityStatuses, activity.statusId),
          owner: activity.owner || '',
          planned: `${formatDate(activity.plannedStart)} – ${formatDate(activity.plannedEnd)}`,
          linkedLabels,
          linkedIds,
          activity,
        }
      }),
    [project],
  )

  const columns = useMemo<ColumnDef<ActivityRow>[]>(() => {
    const defs: ColumnDef<ActivityRow>[] = [
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ getValue }) => <span className="font-semibold">{getValue<string>()}</span>,
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.title, value),
        size: 220,
      },
      {
        accessorKey: 'type',
        header: 'Type',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.type, value),
        size: 110,
      },
      {
        accessorKey: 'phase',
        header: 'Phase',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.phase, value),
        size: 90,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.status, value),
        size: 110,
      },
      {
        accessorKey: 'owner',
        header: 'Owner',
        cell: ({ getValue }) => getValue<string>() || '—',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.owner, value),
        size: 120,
      },
      {
        accessorKey: 'planned',
        header: 'Planned',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.planned, value),
        size: 170,
      },
      {
        accessorKey: 'linkedLabels',
        header: 'Linked Reqs',
        cell: ({ row }) => {
          if (!row.original.linkedIds.length) return '—'
          return (
            <div className="flex flex-wrap gap-1">
              {row.original.linkedIds.map((reqId, index) => {
                const label = row.original.linkedLabels.split(', ')[index] || 'REQ'
                return (
                  <Link key={reqId} className="mono text-[var(--color-accent)] hover:underline" to={`/requirements/${reqId}`}>
                    {label}
                  </Link>
                )
              })}
            </div>
          )
        },
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.linkedLabels, value),
        size: 160,
      },
    ]

    if (editing) {
      defs.push({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex gap-1">
            <button type="button" className="btn btn-ghost px-1.5 py-0.5 text-[0.68rem]" onClick={() => openEdit(row.original.activity)}>
              Edit
            </button>
            <button
              type="button"
              className="btn btn-ghost px-1.5 py-0.5 text-[0.68rem] text-[var(--color-danger)]"
              onClick={() => setDeleteId(row.original.id)}
            >
              Delete
            </button>
          </div>
        ),
        enableSorting: false,
        enableColumnFilter: false,
        enableHiding: false,
        size: 120,
      })
    }

    return defs
  }, [editing])

  return (
    <div className="space-y-2.5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Test Activities</h2>
          <p className="page-subtitle">Reusable activities that can be linked to multiple requirements.</p>
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
        <DataTable
          data={rows}
          columns={columns}
          getRowId={(row) => row.id}
          pageSize={50}
          sizingStorageKey="activities"
          emptyMessage="No activities match the current column filters."
        />
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
                <option key={t.id} value={t.id}>
                  {t.value}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Phase</span>
            <select className="field-input" value={draft.phaseId || ''} onChange={(e) => setDraft((d) => ({ ...d, phaseId: e.target.value }))}>
              {project.lookups.testPhases.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.value}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Status</span>
            <select className="field-input" value={draft.statusId || ''} onChange={(e) => setDraft((d) => ({ ...d, statusId: e.target.value }))}>
              {project.lookups.testActivityStatuses.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.value}
                </option>
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
            <p>
              This will permanently delete the activity and remove requirement links. Related
              verifications/assessments will unlink the activity.
            </p>
          </div>
        }
      />
    </div>
  )
}
