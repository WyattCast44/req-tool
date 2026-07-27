import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { ConfirmDialog } from '../components/Modal'
import { DataTable } from '../components/DataTable'
import {
  RequirementSourceLinkModal,
  type RequirementSourceLinkDraft,
} from '../components/RequirementSourceLinkModal'
import { RichTextEditor, RichTextView } from '../components/RichText'
import { StatusBadge } from '../components/StatusBadge'
import { lookupLabel } from '../lib/defaults'
import { formatDateTime } from '../lib/ids'
import { countDistinctLinkedRequirements } from '../lib/sourceLinks'
import { fuzzyIncludesFilter, plainTextFromHtml } from '../lib/tableFilters'
import { useProjectStore } from '../store/projectStore'
import type { RequirementSourceLink, Source } from '../types/project'

interface AssociatedRequirementRow {
  id: string
  requirementId: string
  sourceIdLabel: string
  shortTitle: string
  status: string
  type: string
  locator: string
  rationale: string
  notes: string
  link: RequirementSourceLink
}

const blankSource = (): Partial<Source> & { title: string } => ({
  identifier: '',
  title: '',
  sourceType: '',
  version: '',
  publisher: '',
  publicationDate: '',
  url: '',
  filePath: '',
  description: '',
  notes: '',
})

export function SourceDetailPage() {
  const { id } = useParams()
  const isNew = id === 'new'
  const navigate = useNavigate()
  const project = useProjectStore((state) => state.project)!
  const editing = useProjectStore((state) => state.mode === 'edit')
  const upsertSource = useProjectStore((state) => state.upsertSource)
  const deleteSource = useProjectStore((state) => state.deleteSource)
  const upsertLink = useProjectStore((state) => state.upsertRequirementSourceLink)
  const deleteLink = useProjectStore((state) => state.deleteRequirementSourceLink)
  const setToast = useProjectStore((state) => state.setToast)

  const existing = useMemo(
    () => (isNew ? null : (project.sources ?? []).find((source) => source.id === id) || null),
    [id, isNew, project.sources],
  )
  const [form, setForm] = useState<Partial<Source> & { title: string }>(
    existing ? { ...existing } : blankSource(),
  )
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [editingLink, setEditingLink] = useState<RequirementSourceLink | null>(null)

  useEffect(() => {
    setForm(existing ? { ...existing } : blankSource())
    setError('')
  }, [existing, isNew])

  const sourceId = existing?.id
  const links = useMemo(
    () => (project.requirementSourceLinks ?? []).filter((link) => link.sourceId === sourceId),
    [project.requirementSourceLinks, sourceId],
  )

  const associatedRows = useMemo<AssociatedRequirementRow[]>(
    () =>
      links.map((link) => {
        const requirement = project.requirements.find((item) => item.id === link.requirementId)
        return {
          id: link.id,
          requirementId: link.requirementId,
          sourceIdLabel: requirement?.sourceId || 'Missing',
          shortTitle: requirement?.shortTitle || '',
          status: lookupLabel(project.lookups.statuses, requirement?.statusId || ''),
          type: link.type,
          locator: link.locator || '',
          rationale: link.rationale || '',
          notes: link.notes || '',
          link,
        }
      }),
    [links, project.lookups.statuses, project.requirements],
  )

  const associatedColumns = useMemo<ColumnDef<AssociatedRequirementRow>[]>(() => {
    const defs: ColumnDef<AssociatedRequirementRow>[] = [
      {
        id: 'requirement',
        accessorFn: (row) =>
          row.shortTitle ? `${row.sourceIdLabel} — ${row.shortTitle}` : row.sourceIdLabel,
        header: 'Requirement',
        cell: ({ row }) => (
          <Link
            className="text-[var(--color-accent)] hover:underline"
            to={`/requirements/${row.original.requirementId}`}
          >
            <span className="mono">{row.original.sourceIdLabel}</span>
            {row.original.shortTitle ? ` — ${row.original.shortTitle}` : ''}
          </Link>
        ),
        filterFn: (row, _id, value) =>
          fuzzyIncludesFilter(
            `${row.original.sourceIdLabel} ${row.original.shortTitle}`,
            value,
          ),
        size: 240,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => <StatusBadge value={getValue<string>()} />,
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.status, value),
        size: 120,
      },
      {
        accessorKey: 'type',
        header: 'Relationship',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.type, value),
        size: 130,
      },
      {
        accessorKey: 'locator',
        header: 'Locator',
        cell: ({ getValue }) => getValue<string>() || '—',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.locator, value),
        size: 140,
      },
      {
        accessorKey: 'rationale',
        header: 'Rationale',
        cell: ({ getValue }) => <RichTextView html={getValue<string>()} />,
        filterFn: (row, _id, value) =>
          fuzzyIncludesFilter(plainTextFromHtml(row.original.rationale), value),
        size: 200,
      },
      {
        accessorKey: 'notes',
        header: 'Notes',
        cell: ({ getValue }) => <RichTextView html={getValue<string>()} />,
        filterFn: (row, _id, value) =>
          fuzzyIncludesFilter(plainTextFromHtml(row.original.notes), value),
        size: 180,
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
              className="btn btn-ghost px-1.5 py-0.5 text-xs"
              onClick={() => {
                setEditingLink(row.original.link)
                setLinkOpen(true)
              }}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn btn-ghost px-1.5 py-0.5 text-xs text-[var(--color-danger)]"
              onClick={() => deleteLink(row.original.id)}
            >
              Unlink
            </button>
          </div>
        ),
        enableSorting: false,
        enableColumnFilter: false,
        enableHiding: false,
        size: 130,
      })
    }

    return defs
  }, [deleteLink, editing])

  if (!isNew && !existing) {
    return (
      <div className="panel p-6">
        <p>Source not found.</p>
        <Link className="btn btn-secondary mt-3" to="/sources">
          Back to sources
        </Link>
      </div>
    )
  }

  const editorName = project.metadata.editorNameDefault || existing?.editorName || ''

  const saveSource = () => {
    const result = upsertSource(
      {
        ...form,
        id: existing?.id,
        title: form.title,
      },
      editorName,
    )
    if (!result.ok || !result.id) {
      setError(result.error || 'Could not save source.')
      return
    }
    setToast(isNew ? 'Source created (local autosave).' : 'Source updated (local autosave).')
    navigate(`/sources/${result.id}`, { replace: true })
  }

  const saveLink = (draft: RequirementSourceLinkDraft) => {
    if (!sourceId) return
    const result = upsertLink(
      {
        id: draft.id,
        requirementId: draft.selectedId,
        sourceId,
        type: draft.type,
        locator: draft.locator,
        rationale: draft.rationale,
        notes: draft.notes,
      },
      editorName,
    )
    if (!result.ok) {
      setToast(result.error || 'Could not save source relationship.')
      return
    }
    setToast(result.warning || 'Source relationship saved.')
    setLinkOpen(false)
    setEditingLink(null)
  }

  return (
    <div className="space-y-3">
      <header className="panel requirement-hero">
        <div className="min-w-0">
          <Link to="/sources" className="requirement-breadcrumb">
            ← All sources
          </Link>
          <div className="mt-2 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-[var(--color-ink-muted)]">
            {isNew ? 'Create source' : `Source · ${form.identifier || 'No identifier'}`}
          </div>
          <h2 className="requirement-title">{isNew ? 'New source' : form.title}</h2>
          {!isNew && form.identifier && (
            <div className="mono mt-1 text-[var(--color-ink-muted)]">{form.identifier}</div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {editing && !isNew && (
            <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          )}
          {editing && (
            <button type="button" className="btn btn-primary" onClick={saveSource}>
              {isNew ? 'Create Source' : 'Save Changes'}
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="panel border-[var(--color-danger)] bg-[var(--color-danger-bg)] p-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-3">
          <SourceSection
            title="Source details"
            description="Identify and locate this source material."
          >
            {editing ? (
              <div className="grid gap-3 md:grid-cols-2">
                <SourceField label="Identifier">
                  <input className="field-input" value={form.identifier || ''} onChange={(event) => setForm((value) => ({ ...value, identifier: event.target.value }))} />
                </SourceField>
                <SourceField label="Title" required>
                  <input className="field-input" value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} />
                </SourceField>
                <SourceField label="Type">
                  <input className="field-input" placeholder="Document, standard, interview…" value={form.sourceType || ''} onChange={(event) => setForm((value) => ({ ...value, sourceType: event.target.value }))} />
                </SourceField>
                <SourceField label="Version">
                  <input className="field-input" value={form.version || ''} onChange={(event) => setForm((value) => ({ ...value, version: event.target.value }))} />
                </SourceField>
                <SourceField label="Publisher / owner">
                  <input className="field-input" value={form.publisher || ''} onChange={(event) => setForm((value) => ({ ...value, publisher: event.target.value }))} />
                </SourceField>
                <SourceField label="Publication date">
                  <input type="date" className="field-input" value={form.publicationDate || ''} onChange={(event) => setForm((value) => ({ ...value, publicationDate: event.target.value }))} />
                </SourceField>
                <SourceField label="URL">
                  <input className="field-input" value={form.url || ''} onChange={(event) => setForm((value) => ({ ...value, url: event.target.value }))} />
                </SourceField>
                <SourceField label="File path">
                  <input className="field-input" value={form.filePath || ''} onChange={(event) => setForm((value) => ({ ...value, filePath: event.target.value }))} />
                </SourceField>
              </div>
            ) : (
              <dl className="summary-list">
                <Summary label="Identifier" value={form.identifier || '—'} />
                <Summary label="Type" value={form.sourceType || '—'} />
                <Summary label="Version" value={form.version || '—'} />
                <Summary label="Publisher / owner" value={form.publisher || '—'} />
                <Summary label="Publication date" value={form.publicationDate || '—'} />
                <Summary label="URL" value={form.url || '—'} />
                <Summary label="File path" value={form.filePath || '—'} />
              </dl>
            )}
          </SourceSection>

          <SourceSection title="Description" description="Scope, authority, and context for this source.">
            {editing ? (
              <RichTextEditor value={form.description || ''} onChange={(description) => setForm((value) => ({ ...value, description }))} />
            ) : (
              <RichTextOrEmpty html={form.description || ''} />
            )}
          </SourceSection>

          <SourceSection title="Notes" description="Working notes about interpretation, access, or use.">
            {editing ? (
              <RichTextEditor value={form.notes || ''} onChange={(notes) => setForm((value) => ({ ...value, notes }))} />
            ) : (
              <RichTextOrEmpty html={form.notes || ''} />
            )}
          </SourceSection>
        </div>

        <aside className="space-y-3">
          <SourceSection title="At a glance">
            <dl className="summary-list">
              <Summary
                label="Linked requirements"
                value={String(countDistinctLinkedRequirements(links, sourceId))}
              />
              {!isNew && existing && (
                <>
                  <Summary label="Created" value={formatDateTime(existing.createdAt)} />
                  <Summary label="Modified" value={formatDateTime(existing.modifiedAt)} />
                  <Summary label="Editor" value={existing.editorName || '—'} />
                </>
              )}
            </dl>
          </SourceSection>
        </aside>
      </div>

      {!isNew && sourceId && (
        <SourceSection
          title="Associated requirements"
          description="Typed relationships from requirements to this source, including pinpoint locators and contextual notes."
          action={
            editing ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setEditingLink(null)
                  setLinkOpen(true)
                }}
              >
                Link Requirement
              </button>
            ) : undefined
          }
        >
          {associatedRows.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-muted)]">No requirements are linked to this source.</p>
          ) : (
            <DataTable
              data={associatedRows}
              columns={associatedColumns}
              getRowId={(row) => row.id}
              pageSize={25}
              maxHeightClassName="max-h-[50vh]"
              sizingStorageKey="source-associated-requirements"
              emptyMessage="No linked requirements match the current column filters."
            />
          )}
        </SourceSection>
      )}

      <RequirementSourceLinkModal
        open={linkOpen}
        title={editingLink ? 'Edit Requirement Relationship' : 'Link Requirement'}
        selectionLabel="Requirement"
        options={project.requirements.map((requirement) => ({
          id: requirement.id,
          label: `${requirement.sourceId} — ${requirement.shortTitle || 'Untitled'}`,
        }))}
        initialLink={editingLink}
        initialSelectedId={editingLink?.requirementId}
        onClose={() => {
          setLinkOpen(false)
          setEditingLink(null)
        }}
        onSave={saveLink}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Permanently delete source?"
        danger
        confirmLabel="Delete Permanently"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!sourceId) return
          deleteSource(sourceId)
          navigate('/sources')
        }}
        message={
          <p>
            Delete <strong>{form.title}</strong> and remove its {links.length} requirement relationship
            {links.length === 1 ? '' : 's'}? This cannot be undone.
          </p>
        }
      />
    </div>
  )
}

function SourceField({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label>
      <span className="field-label">{label}{required ? ' *' : ''}</span>
      {children}
    </label>
  )
}

function SourceSection({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="panel detail-section">
      <div className="detail-section-header">
        <div>
          <h3>{title}</h3>
          {description && <p className="mt-0.5 text-[0.7rem] text-[var(--color-ink-muted)]">{description}</p>}
        </div>
        {action}
      </div>
      <div className="detail-section-body">{children}</div>
    </section>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-row">
      <dt>{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  )
}

function RichTextOrEmpty({ html }: { html: string }) {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
    ? <RichTextView html={html} />
    : <p className="text-sm italic text-[var(--color-ink-muted)]">Not provided.</p>
}
