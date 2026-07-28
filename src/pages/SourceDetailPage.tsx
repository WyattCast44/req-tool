import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import {
  DetailField,
  DetailNotFound,
  DetailSection,
  RichTextOrEmpty,
  SummaryRow,
} from '../components/DetailPrimitives'
import { ConfirmDialog } from '../components/Modal'
import { DataTable } from '../components/DataTable'
import { FuzzySelect } from '../components/FuzzySelect'
import { RichTextEditor, RichTextView } from '../components/RichText'
import { StatusBadge, WatchItemStatusBadge } from '../components/StatusBadge'
import { lookupLabel } from '../lib/defaults'
import { formatDateTime } from '../lib/ids'
import { countRequirementsForSource } from '../lib/sourceLinks'
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

  useEffect(() => {
    setForm(existing ? { ...existing } : blankSource())
    setError('')
  }, [existing, isNew])

  const sourceId = existing?.id
  const ownedRequirements = useMemo(
    () => project.requirements.filter((requirement) => sourceId && requirement.sourceDocumentId === sourceId),
    [project.requirements, sourceId],
  )
  const linksByRequirementId = useMemo(() => {
    const map = new Map<string, RequirementSourceLink>()
    for (const link of project.requirementSourceLinks ?? []) {
      if (link.sourceId !== sourceId) continue
      if (!map.has(link.requirementId)) map.set(link.requirementId, link)
    }
    return map
  }, [project.requirementSourceLinks, sourceId])
  const linkedWatchItems = useMemo(
    () => project.watchItems.filter((watchItem) => sourceId && watchItem.sourceIds.includes(sourceId)),
    [project.watchItems, sourceId],
  )
  const sourceTypeOptions = useMemo(() => {
    const types = new Set<string>()
    for (const source of project.sources ?? []) {
      const type = source.sourceType?.trim()
      if (type) types.add(type)
    }
    return [...types]
      .sort((a, b) => a.localeCompare(b))
      .map((type) => ({ id: type, label: type }))
  }, [project.sources])

  const associatedRows = useMemo<AssociatedRequirementRow[]>(
    () =>
      ownedRequirements.map((requirement) => {
        const link = linksByRequirementId.get(requirement.id)
        return {
          id: requirement.id,
          requirementId: requirement.id,
          sourceIdLabel: requirement.sourceId || 'Missing',
          shortTitle: requirement.shortTitle || '',
          status: lookupLabel(project.lookups.statuses, requirement.statusId),
          type: link?.type || '',
          locator: link?.locator || '',
          rationale: link?.rationale || '',
          notes: link?.notes || '',
        }
      }),
    [linksByRequirementId, ownedRequirements, project.lookups.statuses],
  )

  const associatedColumns = useMemo<ColumnDef<AssociatedRequirementRow>[]>(
    () => [
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
        header: 'Citation',
        cell: ({ getValue }) => getValue<string>() || '—',
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
    ],
    [],
  )

  if (!isNew && !existing) {
    return (
      <DetailNotFound
        message="Source not found."
        backTo="/sources"
        backLabel="Back to sources"
      />
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

  return (
    <div className="space-y-3">
      <header className="panel detail-hero">
        <div className="min-w-0">
          <Link to="/sources" className="detail-breadcrumb">
            ← All sources
          </Link>
          <div className="eyebrow detail-eyebrow">
            {isNew ? 'Create source' : `Source · ${form.identifier || 'No identifier'}`}
          </div>
          <h2 className="detail-title">{isNew ? 'New source' : form.title}</h2>
          {!isNew && form.identifier && (
            <div className="mono mt-1 text-[var(--color-ink-muted)]">{form.identifier}</div>
          )}
        </div>
        <div className="page-header-actions">
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

      {error && <div className="error-banner">{error}</div>}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-3">
          <DetailSection title="Identity" description="How this source is identified and classified.">
            <div className="grid gap-3 md:grid-cols-2">
              <DetailField label="Title" required>
                {editing ? (
                  <input
                    className="field-input"
                    value={form.title}
                    onChange={(e) => setForm((value) => ({ ...value, title: e.target.value }))}
                  />
                ) : (
                  <div>{form.title || '—'}</div>
                )}
              </DetailField>
              <DetailField label="Identifier">
                {editing ? (
                  <input
                    className="field-input"
                    value={form.identifier || ''}
                    onChange={(e) => setForm((value) => ({ ...value, identifier: e.target.value }))}
                  />
                ) : (
                  <div className="mono">{form.identifier || '—'}</div>
                )}
              </DetailField>
              <DetailField label="Source type">
                {editing ? (
                  <FuzzySelect
                    options={sourceTypeOptions}
                    value={form.sourceType || ''}
                    onChange={(sourceType) => setForm((value) => ({ ...value, sourceType }))}
                    placeholder="Search or type a source type…"
                    emptyLabel="No type"
                    allowClear
                    allowCustom
                  />
                ) : (
                  <div>{form.sourceType || '—'}</div>
                )}
              </DetailField>
              <DetailField label="Version">
                {editing ? (
                  <input
                    className="field-input"
                    value={form.version || ''}
                    onChange={(e) => setForm((value) => ({ ...value, version: e.target.value }))}
                  />
                ) : (
                  <div>{form.version || '—'}</div>
                )}
              </DetailField>
              <DetailField label="Publisher">
                {editing ? (
                  <input
                    className="field-input"
                    value={form.publisher || ''}
                    onChange={(e) => setForm((value) => ({ ...value, publisher: e.target.value }))}
                  />
                ) : (
                  <div>{form.publisher || '—'}</div>
                )}
              </DetailField>
              <DetailField label="Publication date">
                {editing ? (
                  <input
                    className="field-input"
                    type="date"
                    value={form.publicationDate || ''}
                    onChange={(e) =>
                      setForm((value) => ({ ...value, publicationDate: e.target.value }))
                    }
                  />
                ) : (
                  <div>{form.publicationDate || '—'}</div>
                )}
              </DetailField>
            </div>
          </DetailSection>

          <DetailSection title="Access" description="Where this source can be retrieved.">
            <div className="grid gap-3 md:grid-cols-2">
              <DetailField label="URL">
                {editing ? (
                  <input
                    className="field-input"
                    value={form.url || ''}
                    onChange={(e) => setForm((value) => ({ ...value, url: e.target.value }))}
                  />
                ) : form.url ? (
                  <a
                    className="text-[var(--color-accent)] hover:underline"
                    href={form.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {form.url}
                  </a>
                ) : (
                  <div>—</div>
                )}
              </DetailField>
              <DetailField label="File path">
                {editing ? (
                  <input
                    className="field-input"
                    value={form.filePath || ''}
                    onChange={(e) => setForm((value) => ({ ...value, filePath: e.target.value }))}
                  />
                ) : (
                  <div className="mono break-all">{form.filePath || '—'}</div>
                )}
              </DetailField>
            </div>
          </DetailSection>

          <DetailSection title="Description" description="What this source covers and why it matters.">
            {editing ? (
              <RichTextEditor
                value={form.description || ''}
                onChange={(description) => setForm((value) => ({ ...value, description }))}
              />
            ) : (
              <RichTextOrEmpty html={form.description || ''} />
            )}
          </DetailSection>

          <DetailSection title="Notes" description="Working notes about interpretation, access, or use.">
            {editing ? (
              <RichTextEditor value={form.notes || ''} onChange={(notes) => setForm((value) => ({ ...value, notes }))} />
            ) : (
              <RichTextOrEmpty html={form.notes || ''} />
            )}
          </DetailSection>
        </div>

        <aside className="space-y-3">
          <DetailSection title="At a glance">
            <dl className="summary-list">
              <SummaryRow
                label="Requirements"
                value={String(countRequirementsForSource(project.requirements, sourceId))}
              />
              <SummaryRow label="Linked watch items" value={String(linkedWatchItems.length)} />
              {!isNew && existing && (
                <>
                  <SummaryRow label="Created" value={formatDateTime(existing.createdAt)} />
                  <SummaryRow label="Modified" value={formatDateTime(existing.modifiedAt)} />
                  <SummaryRow label="Editor" value={existing.editorName || '—'} />
                </>
              )}
            </dl>
          </DetailSection>
        </aside>
      </div>

      {!isNew && sourceId && (
        <DetailSection
          title="Requirements"
          description="Requirements that list this document as their source."
          action={
            editing ? (
              <Link className="btn btn-secondary" to={`/requirements/new?source=${sourceId}`}>
                New Requirement
              </Link>
            ) : undefined
          }
        >
          {associatedRows.length === 0 ? (
            <p className="empty-copy">No requirements use this source document yet.</p>
          ) : (
            <DataTable
              data={associatedRows}
              columns={associatedColumns}
              getRowId={(row) => row.id}
              pageSize={25}
              urlStateKey=""
              maxHeightClassName="max-h-[50vh]"
              sizingStorageKey="source-associated-requirements"
              emptyMessage="No requirements match the current column filters."
            />
          )}
        </DetailSection>
      )}

      {!isNew && sourceId && (
        <DetailSection
          title="Watch Items"
          description="Standalone watch topics linked to this source."
          action={
            editing ? (
              <Link className="btn btn-secondary" to={`/watch-items/new?source=${sourceId}`}>
                New Watch Item
              </Link>
            ) : undefined
          }
        >
          {linkedWatchItems.length === 0 ? (
            <p className="empty-copy">No watch items are linked to this source.</p>
          ) : (
            <ul className="space-y-2">
              {linkedWatchItems.map((watchItem) => (
                <li key={watchItem.id} className="record-card record-card-row">
                  <div>
                    <Link className="font-semibold text-[var(--color-accent)] hover:underline" to={`/watch-items/${watchItem.id}`}>
                      {watchItem.title}
                    </Link>
                    <div className="record-meta">
                      {watchItem.observations.length} observation{watchItem.observations.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <WatchItemStatusBadge value={watchItem.status} />
                </li>
              ))}
            </ul>
          )}
        </DetailSection>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Permanently delete source?"
        danger
        confirmLabel="Delete Permanently"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!sourceId) return
          deleteSource(sourceId, editorName)
          navigate('/sources')
        }}
        message={
          <p>
            Delete <strong>{form.title}</strong> and clear it from {ownedRequirements.length} requirement
            {ownedRequirements.length === 1 ? '' : 's'}? This cannot be undone.
          </p>
        }
      />
    </div>
  )
}
