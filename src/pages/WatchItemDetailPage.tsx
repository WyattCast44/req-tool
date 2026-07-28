import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  DetailField,
  DetailNotFound,
  DetailSection,
  RichTextOrEmpty,
  SummaryRow,
} from '../components/DetailPrimitives'
import { ConfirmDialog } from '../components/Modal'
import { FuzzyMultiSelect } from '../components/FuzzyMultiSelect'
import { RichTextEditor, RichTextView } from '../components/RichText'
import { WatchItemStatusBadge } from '../components/StatusBadge'
import { indexById } from '../lib/collections'
import { formatDateTime } from '../lib/ids'
import { useProjectStore } from '../store/projectStore'
import {
  WATCH_ITEM_STATUSES,
  type WatchItem,
  type WatchObservation,
} from '../types/project'

type WatchItemDraft = Pick<
  WatchItem,
  'title' | 'description' | 'status' | 'requirementIds' | 'sourceIds'
> & {
  observations: Array<Partial<WatchObservation> & { text: string }>
}

function blankWatchItem(requirementId?: string, sourceId?: string): WatchItemDraft {
  return {
    title: '',
    description: '',
    status: 'Open',
    observations: [{ text: '' }],
    requirementIds: requirementId ? [requirementId] : [],
    sourceIds: sourceId ? [sourceId] : [],
  }
}

export function WatchItemDetailPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isNew = id === 'new'
  const navigate = useNavigate()
  const project = useProjectStore((state) => state.project)!
  const editing = useProjectStore((state) => state.mode === 'edit')
  const upsertWatchItem = useProjectStore((state) => state.upsertWatchItem)
  const deleteWatchItem = useProjectStore((state) => state.deleteWatchItem)
  const setToast = useProjectStore((state) => state.setToast)

  const existing = useMemo(
    () => (isNew ? null : project.watchItems.find((watchItem) => watchItem.id === id) || null),
    [id, isNew, project.watchItems],
  )
  const requirementsById = useMemo(
    () => indexById(project.requirements),
    [project.requirements],
  )
  const sourcesById = useMemo(() => indexById(project.sources), [project.sources])
  const initialRequirementId =
    project.requirements.some((requirement) => requirement.id === searchParams.get('requirement'))
      ? searchParams.get('requirement') || undefined
      : undefined
  const initialSourceId =
    project.sources.some((source) => source.id === searchParams.get('source'))
      ? searchParams.get('source') || undefined
      : undefined
  const [form, setForm] = useState<WatchItemDraft>(
    existing
      ? { ...existing, observations: existing.observations.map((item) => ({ ...item })) }
      : blankWatchItem(initialRequirementId, initialSourceId),
  )
  const [editorName, setEditorName] = useState(
    project.metadata.editorNameDefault || existing?.editorName || '',
  )
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setForm(
      existing
        ? { ...existing, observations: existing.observations.map((item) => ({ ...item })) }
        : blankWatchItem(initialRequirementId, initialSourceId),
    )
    setEditorName(project.metadata.editorNameDefault || existing?.editorName || '')
    setError('')
  }, [existing, initialRequirementId, initialSourceId, project.metadata.editorNameDefault])

  if (!isNew && !existing) {
    return (
      <DetailNotFound
        message="Watch item not found."
        backTo="/watch-items"
        backLabel="Back to Watch Items"
      />
    )
  }

  const save = () => {
    const result = upsertWatchItem(
      {
        ...form,
        id: existing?.id,
      },
      editorName,
    )
    if (!result.ok || !result.id) {
      setError(result.error || 'Could not save watch item.')
      return
    }
    setToast(isNew ? 'Watch item created (local autosave).' : 'Watch item updated (local autosave).')
    navigate(`/watch-items/${result.id}`, { replace: true })
  }

  const patchObservation = (index: number, text: string) => {
    setForm((current) => ({
      ...current,
      observations: current.observations.map((observation, itemIndex) =>
        itemIndex === index ? { ...observation, text } : observation,
      ),
    }))
  }

  return (
    <div className="space-y-3">
      <header className="panel detail-hero">
        <div className="min-w-0">
          <Link to="/watch-items" className="detail-breadcrumb">
            ← All watch items
          </Link>
          <div className="eyebrow detail-eyebrow">
            {isNew ? 'Create watch item' : 'Watch Item'}
          </div>
          <h2 className="detail-title">
            {isNew ? 'New watch item' : form.title || 'Untitled watch item'}
          </h2>
          {!isNew && (
            <div className="mt-2">
              <WatchItemStatusBadge value={form.status} />
            </div>
          )}
        </div>
        <div className="page-header-actions">
          {editing && !isNew && (
            <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          )}
          {editing && (
            <button type="button" className="btn btn-primary" onClick={save}>
              {isNew ? 'Create Watch Item' : 'Save Changes'}
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="panel notice notice-danger">
          {error}
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-3">
          <DetailSection
            title="Watch item"
            description="Define the topic being watched and its current disposition."
          >
            {editing ? (
              <div className="space-y-3">
                <DetailField label="Title" required>
                  <input
                    className="field-input"
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </DetailField>
                <DetailField label="Status" required>
                  <select
                    className="field-input"
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        status: event.target.value as WatchItem['status'],
                      }))
                    }
                  >
                    {WATCH_ITEM_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </DetailField>
                <DetailField label="Description">
                  <RichTextEditor
                    value={form.description}
                    onChange={(description) =>
                      setForm((current) => ({ ...current, description }))
                    }
                    placeholder="Describe the issue, concern, or topic being watched…"
                  />
                </DetailField>
              </div>
            ) : (
              <RichTextOrEmpty html={form.description} empty="No description recorded." />
            )}
          </DetailSection>

          <DetailSection
            title="Observations"
            description="A chronological record of what has been observed about this item."
            action={
              editing ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      observations: [...current.observations, { text: '' }],
                    }))
                  }
                >
                  Add Observation
                </button>
              ) : undefined
            }
          >
            <div className="space-y-3">
              {form.observations.map((observation, index) => (
                <div key={observation.id || `new-${index}`} className="record-card">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-[var(--color-ink-muted)]">
                      Observation {index + 1}
                      {observation.createdAt
                        ? ` · ${formatDateTime(observation.createdAt)} · ${observation.editorName || 'Unknown editor'}`
                        : ''}
                    </div>
                    {editing && form.observations.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-ghost-danger"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            observations: current.observations.filter((_, itemIndex) => itemIndex !== index),
                          }))
                        }
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {editing ? (
                    <RichTextEditor
                      value={observation.text}
                      onChange={(text) => patchObservation(index, text)}
                      placeholder="Record an observation…"
                    />
                  ) : (
                    <RichTextView html={observation.text} />
                  )}
                </div>
              ))}
            </div>
          </DetailSection>
        </div>

        <aside className="space-y-3">
          <DetailSection
            title="Linked records"
            description="Optional context from requirements and source material."
          >
            {editing ? (
              <div className="space-y-3">
                <DetailField label="Requirements">
                  <FuzzyMultiSelect
                    options={project.requirements.map((requirement) => ({
                      id: requirement.id,
                      label: `${requirement.sourceId} — ${requirement.shortTitle || 'Untitled'}`,
                    }))}
                    value={form.requirementIds}
                    onChange={(requirementIds) =>
                      setForm((current) => ({ ...current, requirementIds }))
                    }
                    placeholder="Search requirements…"
                  />
                </DetailField>
                <DetailField label="Sources">
                  <FuzzyMultiSelect
                    options={project.sources.map((source) => ({
                      id: source.id,
                      label: `${source.identifier ? `${source.identifier} — ` : ''}${source.title}`,
                    }))}
                    value={form.sourceIds}
                    onChange={(sourceIds) =>
                      setForm((current) => ({ ...current, sourceIds }))
                    }
                    placeholder="Search sources…"
                  />
                </DetailField>
              </div>
            ) : (
              <div className="space-y-3">
                <LinkedRequirements ids={form.requirementIds} />
                <LinkedSources ids={form.sourceIds} />
              </div>
            )}
          </DetailSection>

          <DetailSection title="Record history">
            {editing && (
              <DetailField label="Editor">
                <input
                  className="field-input"
                  value={editorName}
                  onChange={(event) => setEditorName(event.target.value)}
                />
              </DetailField>
            )}
            {!isNew && existing && (
              <dl className="summary-list mt-3">
                <SummaryRow label="Created" value={formatDateTime(existing.createdAt)} />
                <SummaryRow label="Modified" value={formatDateTime(existing.modifiedAt)} />
                <SummaryRow label="Editor" value={existing.editorName || '—'} />
              </dl>
            )}
          </DetailSection>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Permanently delete watch item?"
        danger
        confirmLabel="Delete Permanently"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!existing) return
          deleteWatchItem(existing.id)
          navigate('/watch-items')
        }}
        message={
          <p>
            Delete <strong>{form.title}</strong> and its {form.observations.length} observation
            {form.observations.length === 1 ? '' : 's'}? This cannot be undone.
          </p>
        }
      />
    </div>
  )

  function LinkedRequirements({ ids }: { ids: string[] }) {
    if (ids.length === 0) return <LinkGroup label="Requirements" empty="None linked" />
    return (
      <LinkGroup label="Requirements">
        {ids.map((requirementId) => {
          const requirement = requirementsById.get(requirementId)
          return (
            <li key={requirementId}>
              <Link className="text-[var(--color-accent)] hover:underline" to={`/requirements/${requirementId}`}>
                {requirement ? `${requirement.sourceId} — ${requirement.shortTitle || 'Untitled'}` : 'Missing requirement'}
              </Link>
            </li>
          )
        })}
      </LinkGroup>
    )
  }

  function LinkedSources({ ids }: { ids: string[] }) {
    if (ids.length === 0) return <LinkGroup label="Sources" empty="None linked" />
    return (
      <LinkGroup label="Sources">
        {ids.map((sourceId) => {
          const source = sourcesById.get(sourceId)
          return (
            <li key={sourceId}>
              <Link className="text-[var(--color-accent)] hover:underline" to={`/sources/${sourceId}`}>
                {source ? `${source.identifier ? `${source.identifier} — ` : ''}${source.title}` : 'Missing source'}
              </Link>
            </li>
          )
        })}
      </LinkGroup>
    )
  }
}

function LinkGroup({ label, empty, children }: { label: string; empty?: string; children?: ReactNode }) {
  return (
    <div>
      <div className="field-label">{label}</div>
      {empty ? (
        <p className="empty-copy">{empty}</p>
      ) : (
        <ul className="space-y-1 text-sm">{children}</ul>
      )}
    </div>
  )
}
