import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { useProjectStore } from '../store/projectStore'
import {
  DetailField as Field,
  DetailNotFound,
  DetailSection as Section,
  RichTextOrEmpty,
  SummaryRow as SummaryValue,
} from '../components/DetailPrimitives'
import { RichTextEditor, RichTextView } from '../components/RichText'
import {
  AssessmentBadge,
  ClassificationBadge,
  StatusBadge,
  WatchBadge,
  WatchItemStatusBadge,
} from '../components/StatusBadge'
import { ConfirmDialog, Modal } from '../components/Modal'
import { DataTable } from '../components/DataTable'
import { FuzzySelect } from '../components/FuzzySelect'
import { lookupLabel } from '../lib/defaults'
import { formatDateTime, slugifyFilename, suggestNextRequirementSourceId } from '../lib/ids'
import { fuzzyIncludesFilter, plainTextFromHtml } from '../lib/tableFilters'
import {
  RECIPROCAL_RELATIONSHIP,
  RELATIONSHIP_TYPES,
  SOURCE_RELATIONSHIP_TYPES,
  type RelationshipType,
  type Requirement,
  type RequirementRelationship,
  type RequirementSourceLink,
  type SourceRelationshipType,
  type Tag,
  type TagCategory,
} from '../types/project'
import { currentAssessment } from '../lib/filters'
import { downloadTextFile, requirementsToCsv } from '../lib/export'
import { downloadRequirementDocx } from '../lib/requirementsDocxExport'
import {
  RequirementSourceLinkModal,
  type RequirementSourceLinkDraft,
} from '../components/RequirementSourceLinkModal'

type RequirementTab = 'overview' | 'traceability' | 'verification'

interface RelationshipRow {
  id: string
  otherId: string
  relatedSourceId: string
  title: string
  direction: string
  type: string
  status: string
  rationale: string
  relationship: RequirementRelationship
}

interface SourceLinkRow {
  id: string
  sourceId: string
  sourceLabel: string
  type: string
  locator: string
  rationale: string
  notes: string
  link: RequirementSourceLink
}

function emptyReq(projectDefaults: { statusId: string; classificationId: string }): Partial<Requirement> {
  return {
    sourceId: '',
    sourceDocumentId: '',
    shortTitle: '',
    requirementText: '',
    statusId: projectDefaults.statusId,
    classificationId: projectDefaults.classificationId,
    description: '',
    analystNotes: '',
    rationale: '',
    typeId: '',
    priorityId: '',
    tagIds: [],
    isDerived: false,
    verificationNotes: '',
    evidenceIds: [],
  }
}

export function RequirementDetailPage() {
  const { id } = useParams()
  const isNew = id === 'new'
  const navigate = useNavigate()
  const project = useProjectStore((s) => s.project)!
  const mode = useProjectStore((s) => s.mode)
  const editing = mode === 'edit'
  const upsertRequirement = useProjectStore((s) => s.upsertRequirement)
  const deleteRequirement = useProjectStore((s) => s.deleteRequirement)
  const upsertRelationship = useProjectStore((s) => s.upsertRelationship)
  const deleteRelationship = useProjectStore((s) => s.deleteRelationship)
  const upsertRequirementSourceLink = useProjectStore((s) => s.upsertRequirementSourceLink)
  const deleteRequirementSourceLink = useProjectStore((s) => s.deleteRequirementSourceLink)
  const linkRequirementActivity = useProjectStore((s) => s.linkRequirementActivity)
  const unlinkRequirementActivity = useProjectStore((s) => s.unlinkRequirementActivity)
  const upsertEvidence = useProjectStore((s) => s.upsertEvidence)
  const upsertVerification = useProjectStore((s) => s.upsertVerification)
  const deleteVerification = useProjectStore((s) => s.deleteVerification)
  const upsertAssessment = useProjectStore((s) => s.upsertAssessment)
  const deleteAssessment = useProjectStore((s) => s.deleteAssessment)
  const setToast = useProjectStore((s) => s.setToast)
  const [searchParams, setSearchParams] = useSearchParams()
  const requirementDetailSuffix = searchParams.toString() ? `?${searchParams.toString()}` : ''
  const requirementListParams = useMemo(() => {
    const next = new URLSearchParams(searchParams)
    next.delete('tab')
    return next
  }, [searchParams])
  const requirementListHref = `/requirements${
    requirementListParams.toString() ? `?${requirementListParams.toString()}` : ''
  }`
  const tabParam = searchParams.get('tab')
  const activeTab: RequirementTab =
    tabParam === 'traceability' || tabParam === 'verification' ? tabParam : 'overview'
  const setActiveTab = (tab: RequirementTab) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (tab === 'overview') next.delete('tab')
      else next.set('tab', tab)
      return next
    }, { replace: true })
  }

  const existing = useMemo(
    () => (isNew ? null : project.requirements.find((r) => r.id === id) || null),
    [isNew, project.requirements, id],
  )

  const defaultStatus = project.lookups.statuses.find((s) => s.value === 'Draft')?.id || project.lookups.statuses[0]?.id || ''
  const defaultClass =
    project.lookups.classifications.find((s) => s.value === 'UNCLASSIFIED')?.id ||
    project.lookups.classifications[0]?.id ||
    ''

  const [form, setForm] = useState<Partial<Requirement>>(
    existing || emptyReq({ statusId: defaultStatus, classificationId: defaultClass }),
  )
  const [editorName, setEditorName] = useState(project.metadata.editorNameDefault || '')
  const [changeSummary, setChangeSummary] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [relOpen, setRelOpen] = useState(false)
  const [sourceLinkOpen, setSourceLinkOpen] = useState(false)
  const [editingSourceLink, setEditingSourceLink] = useState<RequirementSourceLink | null>(null)
  const [createSourceLinkType, setCreateSourceLinkType] = useState<SourceRelationshipType>('Cites')
  const [createSourceLocator, setCreateSourceLocator] = useState('')
  const [sourceIdTouched, setSourceIdTouched] = useState(false)
  const [wordExportStatus, setWordExportStatus] = useState('')
  const [relDraft, setRelDraft] = useState({
    targetRequirementId: '',
    type: 'Supports' as RelationshipType,
    rationale: '',
    notes: '',
  })

  const presetSourceDocumentId = searchParams.get('source') || ''

  const sourcesRef = useRef(project.sources)
  const requirementsRef = useRef(project.requirements)
  sourcesRef.current = project.sources
  requirementsRef.current = project.requirements

  useEffect(() => {
    if (existing) {
      setForm({ ...existing, sourceDocumentId: existing.sourceDocumentId || '' })
      setEditorName(project.metadata.editorNameDefault || existing.editorName || '')
      setChangeSummary('')
      return
    }
    if (!isNew) return

    const sources = sourcesRef.current ?? []
    const requirements = requirementsRef.current
    const blank = emptyReq({ statusId: defaultStatus, classificationId: defaultClass })
    const sourceDocumentId =
      presetSourceDocumentId && sources.some((source) => source.id === presetSourceDocumentId)
        ? presetSourceDocumentId
        : ''
    let sourceId = ''
    if (sourceDocumentId) {
      const selectedSource = sources.find((source) => source.id === sourceDocumentId)
      const ownedIds = requirements
        .filter((requirement) => requirement.sourceDocumentId === sourceDocumentId)
        .map((requirement) => requirement.sourceId)
      const existingIds =
        ownedIds.length > 0 ? ownedIds : requirements.map((requirement) => requirement.sourceId)
      sourceId = suggestNextRequirementSourceId(
        existingIds,
        selectedSource?.identifier || null,
      )
    }
    setForm({ ...blank, sourceDocumentId, sourceId })
    setCreateSourceLinkType('Cites')
    setCreateSourceLocator('')
    setSourceIdTouched(false)
    setEditorName(project.metadata.editorNameDefault || '')
    setChangeSummary('')
  }, [existing, isNew, defaultStatus, defaultClass, presetSourceDocumentId, project.metadata.editorNameDefault])

  const sourceDocumentOptions = useMemo(
    () =>
      (project.sources ?? [])
        .map((source) => ({
          id: source.id,
          label: `${source.identifier ? `${source.identifier} — ` : ''}${source.title}`,
          keywords: [source.sourceType, source.publisher, source.version].filter(Boolean).join(' '),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [project.sources],
  )

  const selectedSourceDocument = useMemo(
    () => (project.sources ?? []).find((source) => source.id === form.sourceDocumentId) || null,
    [form.sourceDocumentId, project.sources],
  )

  const applySuggestedSourceId = (sourceDocumentId: string) => {
    if (sourceIdTouched) return
    const selectedSource = (project.sources ?? []).find((source) => source.id === sourceDocumentId)
    const ownedIds = project.requirements
      .filter((requirement) => requirement.sourceDocumentId === sourceDocumentId)
      .map((requirement) => requirement.sourceId)
    const existingIds =
      ownedIds.length > 0
        ? ownedIds
        : project.requirements.map((requirement) => requirement.sourceId)
    setForm((prev) => ({
      ...prev,
      sourceId: suggestNextRequirementSourceId(existingIds, selectedSource?.identifier || null),
    }))
  }

  const handleSourceDocumentChange = (sourceDocumentId: string) => {
    setForm((prev) => ({ ...prev, sourceDocumentId }))
    if (!sourceDocumentId) return
    if (isNew) applySuggestedSourceId(sourceDocumentId)
  }

  const reqId = existing?.id
  const relationships = useMemo(
    () =>
      project.relationships.filter(
        (r) => r.sourceRequirementId === reqId || r.targetRequirementId === reqId,
      ),
    [project.relationships, reqId],
  )
  const activityLinks = useMemo(
    () => project.requirementActivityLinks.filter((l) => l.requirementId === reqId),
    [project.requirementActivityLinks, reqId],
  )
  const sourceLinks = useMemo(
    () => (project.requirementSourceLinks ?? []).filter((link) => link.requirementId === reqId),
    [project.requirementSourceLinks, reqId],
  )
  const verifications = useMemo(
    () => project.verifications.filter((v) => v.requirementId === reqId),
    [project.verifications, reqId],
  )
  const assessments = useMemo(
    () =>
      project.assessments
        .filter((a) => a.requirementId === reqId)
        .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)),
    [project.assessments, reqId],
  )
  const current = reqId ? currentAssessment(project, reqId) : undefined
  const linkedWatchItems = useMemo(
    () => project.watchItems.filter((watchItem) => reqId && watchItem.requirementIds.includes(reqId)),
    [project.watchItems, reqId],
  )

  const relationshipRows = useMemo<RelationshipRow[]>(
    () =>
      relationships.map((rel) => {
        const outgoing = rel.sourceRequirementId === reqId
        const otherId = outgoing ? rel.targetRequirementId : rel.sourceRequirementId
        const other = project.requirements.find((r) => r.id === otherId)
        return {
          id: rel.id,
          otherId,
          relatedSourceId: other?.sourceId || 'Missing',
          title: other?.shortTitle || '',
          direction: outgoing ? 'Outgoing' : 'Incoming',
          type: outgoing ? rel.type : RECIPROCAL_RELATIONSHIP[rel.type] || rel.type,
          status: lookupLabel(project.lookups.statuses, other?.statusId || ''),
          rationale: rel.rationale || '',
          relationship: rel,
        }
      }),
    [project.lookups.statuses, project.requirements, relationships, reqId],
  )

  const relationshipColumns = useMemo<ColumnDef<RelationshipRow>[]>(() => {
    const defs: ColumnDef<RelationshipRow>[] = [
      {
        accessorKey: 'relatedSourceId',
        header: 'Related ID',
        cell: ({ row }) => (
          <Link
            className="text-[var(--color-accent)] hover:underline"
            to={`/requirements/${row.original.otherId}${requirementDetailSuffix}`}
          >
            {row.original.relatedSourceId}
          </Link>
        ),
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.relatedSourceId, value),
        size: 140,
      },
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ getValue }) => getValue<string>() || '—',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.title, value),
        size: 200,
      },
      {
        accessorKey: 'direction',
        header: 'Direction',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.direction, value),
        size: 110,
      },
      {
        accessorKey: 'type',
        header: 'Type',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.type, value),
        size: 130,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => <StatusBadge value={getValue<string>()} />,
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.status, value),
        size: 120,
      },
      {
        accessorKey: 'rationale',
        header: 'Rationale',
        cell: ({ getValue }) => getValue<string>() || '—',
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.rationale, value),
        size: 220,
      },
    ]

    if (editing) {
      defs.push({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-ghost-danger"
            onClick={() => deleteRelationship(row.original.id)}
          >
            Remove
          </button>
        ),
        enableSorting: false,
        enableColumnFilter: false,
        enableHiding: false,
        size: 100,
      })
    }

    return defs
  }, [deleteRelationship, editing, requirementDetailSuffix])

  const sourceLinkRows = useMemo<SourceLinkRow[]>(
    () =>
      sourceLinks.map((link) => {
        const source = (project.sources ?? []).find((item) => item.id === link.sourceId)
        return {
          id: link.id,
          sourceId: link.sourceId,
          sourceLabel: source
            ? `${source.identifier ? `${source.identifier} — ` : ''}${source.title}`
            : 'Missing source',
          type: link.type,
          locator: link.locator || '',
          rationale: link.rationale || '',
          notes: link.notes || '',
          link,
        }
      }),
    [project.sources, sourceLinks],
  )

  const sourceLinkColumns = useMemo<ColumnDef<SourceLinkRow>[]>(() => {
    const defs: ColumnDef<SourceLinkRow>[] = [
      {
        accessorKey: 'sourceLabel',
        header: 'Source',
        cell: ({ row }) => {
          const source = (project.sources ?? []).find((item) => item.id === row.original.sourceId)
          return (
            <Link className="text-[var(--color-accent)] hover:underline" to={`/sources/${row.original.sourceId}`}>
              {source?.identifier && <span className="mono">{source.identifier} — </span>}
              {source?.title || 'Missing source'}
            </Link>
          )
        },
        filterFn: (row, _id, value) => fuzzyIncludesFilter(row.original.sourceLabel, value),
        size: 240,
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
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setEditingSourceLink(row.original.link)
                setSourceLinkOpen(true)
              }}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-ghost-danger"
              onClick={() => deleteRequirementSourceLink(row.original.id)}
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
  }, [deleteRequirementSourceLink, editing, project.sources])

  if (!isNew && !existing) {
    return (
      <DetailNotFound
        message="Requirement not found."
        backTo={requirementListHref}
        backLabel="Back to list"
      />
    )
  }

  const save = () => {
    const sourceDocumentId = form.sourceDocumentId?.trim() || ''
    const result = upsertRequirement(
      {
        ...form,
        id: existing?.id,
        sourceId: form.sourceId || '',
        sourceDocumentId,
        requirementText: form.requirementText || '',
        statusId: form.statusId || '',
        classificationId: form.classificationId || '',
      },
      {
        editorName,
        changeSummary: isNew ? changeSummary || 'Created requirement' : changeSummary,
        isNew,
      },
    )
    setErrors(result.errors)
    if (result.ok && result.id) {
      if (sourceDocumentId) {
        const alreadyLinked = (project.requirementSourceLinks ?? []).some(
          (link) => link.requirementId === result.id && link.sourceId === sourceDocumentId,
        )
        if (!alreadyLinked) {
          const linkResult = upsertRequirementSourceLink(
            {
              requirementId: result.id,
              sourceId: sourceDocumentId,
              type: isNew ? createSourceLinkType : 'Cites',
              locator: isNew ? createSourceLocator : '',
              rationale: '',
              notes: '',
            },
            editorName || project.metadata.editorNameDefault || '',
          )
          if (!linkResult.ok) {
            setToast(
              result.ok
                ? 'Requirement saved, but the source citation could not be created.'
                : linkResult.error || 'Could not save source citation.',
            )
            navigate(`/requirements/${result.id}${requirementDetailSuffix}`, { replace: true })
            return
          }
          if (linkResult.warning) {
            setToast(linkResult.warning)
            navigate(`/requirements/${result.id}${requirementDetailSuffix}`, { replace: true })
            return
          }
        }
      }
      setToast(isNew ? 'Requirement created (local autosave).' : 'Requirement updated (local autosave).')
      navigate(`/requirements/${result.id}${requirementDetailSuffix}`, { replace: true })
    }
  }

  const patch = <K extends keyof Requirement>(key: K, value: Requirement[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="requirement-page">
      <header className="panel detail-hero">
        <div className="min-w-0">
          <Link to={requirementListHref} className="detail-breadcrumb">
            ← All requirements
          </Link>
          <div className="eyebrow detail-eyebrow">
            {isNew ? 'Create requirement' : `Requirement · ${form.sourceId || 'No source ID'}`}
          </div>
          <h2 className="detail-title">
            {isNew ? 'New requirement' : form.shortTitle || form.sourceId || 'Untitled requirement'}
          </h2>
          {!isNew && form.shortTitle && (
            <div className="mono mt-1 text-[var(--color-ink-muted)]">{form.sourceId}</div>
          )}
          {!isNew && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <StatusBadge value={lookupLabel(project.lookups.statuses, form.statusId || '')} />
              {linkedWatchItems.length > 0 && <WatchBadge />}
              <ClassificationBadge value={lookupLabel(project.lookups.classifications, form.classificationId || '')} />
              {current && (
                <AssessmentBadge value={lookupLabel(project.lookups.assessmentResults, current.resultId)} />
              )}
            </div>
          )}
        </div>
        <div className="page-header-actions">
          {reqId && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  if (!existing) return
                  downloadTextFile(
                    `${slugifyFilename(project.metadata.name)}_${slugifyFilename(existing.sourceId)}.csv`,
                    requirementsToCsv(project, [existing]),
                    'text/csv',
                  )
                }}
              >
                Export CSV
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={Boolean(wordExportStatus)}
                onClick={() => {
                  if (!existing || wordExportStatus) return
                  setWordExportStatus('Starting Word export…')
                  void downloadRequirementDocx(
                    project,
                    existing.id,
                    existing.sourceId,
                    setWordExportStatus,
                  )
                    .then(() => setToast(`${existing.sourceId} exported to Word.`))
                    .catch((error: unknown) => {
                      setToast(
                        error instanceof Error
                          ? error.message
                          : 'Could not generate the Word document.',
                      )
                    })
                    .finally(() => setWordExportStatus(''))
                }}
              >
                {wordExportStatus || 'Export Word'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate(`/graph?focus=${encodeURIComponent(reqId)}`)}
              >
                Open in Graph
              </button>
              <Link className="btn btn-secondary" to={`/print?ids=${reqId}`}>
                Print Report
              </Link>
            </>
          )}
          {editing && !isNew && (
            <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          )}
          {editing && (
            <button type="button" className="btn btn-primary" onClick={save}>
              {isNew ? 'Create Requirement' : 'Save Changes'}
            </button>
          )}
        </div>
      </header>

      {errors.length > 0 && (
        <div className="panel notice notice-danger requirement-errors">
          <ul className="list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {!isNew && (
        <nav className="panel requirement-tabs" role="tablist" aria-label="Requirement detail pages">
          <RequirementTabButton
            id="overview"
            label="Overview"
            description="Statement and analysis"
            activeTab={activeTab}
            onSelect={setActiveTab}
          />
          <RequirementTabButton
            id="traceability"
            label="Traceability"
            description="Relationships and test activities"
            count={relationships.length + sourceLinks.length + activityLinks.length}
            activeTab={activeTab}
            onSelect={setActiveTab}
          />
          <RequirementTabButton
            id="verification"
            label="Verification & Evidence"
            description="Verification, evidence, and assessments"
            count={verifications.length + (form.evidenceIds || []).length + assessments.length}
            activeTab={activeTab}
            onSelect={setActiveTab}
          />
        </nav>
      )}

      <div className="requirement-layout">
        {activeTab === 'overview' && (
        <div
          id="requirement-panel-overview"
          className="requirement-tab-panel min-w-0 space-y-3"
          role="tabpanel"
          aria-labelledby={isNew ? undefined : 'requirement-tab-overview'}
        >
          <Section
            id="requirement-statement"
            title="Requirement statement"
            description="The authoritative behavior, capability, or constraint."
          >
            {editing ? (
              <Field label="Requirement text" required>
                <RichTextEditor
                  value={form.requirementText || ''}
                  onChange={(html) => patch('requirementText', html)}
                  placeholder="Enter the requirement statement…"
                />
              </Field>
            ) : (
              <DetailContent html={form.requirementText || ''} prominent />
            )}
          </Section>

          <Section
            id="context-analysis"
            title="Context & analysis"
            description="Supporting explanation, intent, and analyst interpretation."
          >
            {editing ? (
              <div className="space-y-3">
                <Field label="Description">
                  <RichTextEditor value={form.description || ''} onChange={(html) => patch('description', html)} />
                </Field>
                <Field label="Requirement rationale">
                  <RichTextEditor value={form.rationale || ''} onChange={(html) => patch('rationale', html)} />
                </Field>
                <Field label="Analyst notes">
                  <RichTextEditor value={form.analystNotes || ''} onChange={(html) => patch('analystNotes', html)} />
                </Field>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-line)]">
                <DetailGroup label="Description" html={form.description || ''} />
                <DetailGroup label="Rationale" html={form.rationale || ''} />
                <DetailGroup label="Analyst notes" html={form.analystNotes || ''} />
              </div>
            )}
          </Section>
        </div>
        )}

        <aside className="requirement-context-rail min-w-0 space-y-3">
          <Section
            id="requirement-summary"
            title="At a glance"
            description={editing ? 'Core identity and categorization.' : undefined}
          >
            {editing ? (
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
                <Field label="Source document">
                  {sourceDocumentOptions.length > 0 ? (
                    <FuzzySelect
                      options={sourceDocumentOptions}
                      value={form.sourceDocumentId || ''}
                      onChange={handleSourceDocumentChange}
                      placeholder="Search sources…"
                      emptyLabel="No source document"
                      allowClear
                    />
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-[0.72rem] text-[var(--color-ink-muted)]">
                        No sources exist yet. Create one first, then assign it here.
                      </p>
                      <Link className="btn btn-secondary" to="/sources/new">
                        Create Source
                      </Link>
                    </div>
                  )}
                </Field>
                {isNew && form.sourceDocumentId && (
                  <>
                    <Field label="Source relationship">
                      <select
                        className="field-input"
                        value={createSourceLinkType}
                        onChange={(e) =>
                          setCreateSourceLinkType(e.target.value as SourceRelationshipType)
                        }
                      >
                        {SOURCE_RELATIONSHIP_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Source locator">
                      <input
                        className="field-input"
                        value={createSourceLocator}
                        placeholder="Section, page, paragraph…"
                        onChange={(e) => setCreateSourceLocator(e.target.value)}
                      />
                    </Field>
                  </>
                )}
                <Field label="Source requirement ID" required>
                  <input
                    className="field-input"
                    value={form.sourceId || ''}
                    onChange={(e) => {
                      setSourceIdTouched(true)
                      patch('sourceId', e.target.value)
                    }}
                  />
                </Field>
                <Field label="Short title">
                  <input
                    className="field-input"
                    value={form.shortTitle || ''}
                    onChange={(e) => patch('shortTitle', e.target.value)}
                  />
                </Field>
                <Field label="Status" required>
                  <select
                    className="field-input"
                    value={form.statusId || ''}
                    onChange={(e) => patch('statusId', e.target.value)}
                  >
                    {project.lookups.statuses.filter((s) => s.active).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.value}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Classification" required>
                  <select
                    className="field-input"
                    value={form.classificationId || ''}
                    onChange={(e) => patch('classificationId', e.target.value)}
                  >
                    {project.lookups.classifications.filter((s) => s.active).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.value}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Requirement type">
                  <select
                    className="field-input"
                    value={form.typeId || ''}
                    onChange={(e) => patch('typeId', e.target.value)}
                  >
                    <option value="">—</option>
                    {project.lookups.types.filter((s) => s.active).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.value}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Priority">
                  <select
                    className="field-input"
                    value={form.priorityId || ''}
                    onChange={(e) => patch('priorityId', e.target.value)}
                  >
                    <option value="">—</option>
                    {project.lookups.priorities.filter((s) => s.active).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.value}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Derived requirement">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(form.isDerived)}
                      onChange={(e) => patch('isDerived', e.target.checked)}
                    />
                    Mark as derived
                  </label>
                </Field>
                <Field label="Tags">
                  <TagPicker
                    categories={project.tagCategories}
                    tags={project.tags}
                    selectedIds={form.tagIds || []}
                    onChange={(tagIds) => patch('tagIds', tagIds)}
                  />
                </Field>
              </div>
            ) : (
              <div className="space-y-3">
                <dl className="summary-list">
                  <SummaryValue label="Source document">
                    {selectedSourceDocument ? (
                      <Link
                        className="text-[var(--color-accent)] hover:underline"
                        to={`/sources/${selectedSourceDocument.id}`}
                      >
                        {selectedSourceDocument.identifier
                          ? `${selectedSourceDocument.identifier} — `
                          : ''}
                        {selectedSourceDocument.title}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </SummaryValue>
                  <SummaryValue label="Status">
                    <StatusBadge value={lookupLabel(project.lookups.statuses, form.statusId || '')} />
                  </SummaryValue>
                  <SummaryValue label="Assessment">
                    {current ? (
                      <AssessmentBadge value={lookupLabel(project.lookups.assessmentResults, current.resultId)} />
                    ) : (
                      'Not assessed'
                    )}
                  </SummaryValue>
                  <SummaryValue label="Type" value={lookupLabel(project.lookups.types, form.typeId || '')} />
                  <SummaryValue label="Priority" value={lookupLabel(project.lookups.priorities, form.priorityId || '')} />
                  <SummaryValue label="Classification">
                    <ClassificationBadge value={lookupLabel(project.lookups.classifications, form.classificationId || '')} />
                  </SummaryValue>
                  <SummaryValue label="Derived" value={form.isDerived ? 'Yes' : 'No'} />
                  <SummaryValue label="Watch items" value={String(linkedWatchItems.length)} />
                </dl>
                <TagSummary
                  categories={project.tagCategories}
                  tags={project.tags}
                  selectedIds={form.tagIds || []}
                />
              </div>
            )}
          </Section>

          <Section id="record-history" title="Record history">
            {editing && (
              <div className="mb-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
                <Field label="Editor name" required={!isNew}>
                  <input className="field-input" value={editorName} onChange={(e) => setEditorName(e.target.value)} />
                </Field>
                <Field label="Change summary" required={!isNew}>
                  <input className="field-input" value={changeSummary} onChange={(e) => setChangeSummary(e.target.value)} />
                </Field>
              </div>
            )}
            {!isNew && existing ? (
              <dl className="summary-list">
                <SummaryValue label="Created" value={formatDateTime(existing.createdAt)} />
                <SummaryValue label="Last modified" value={formatDateTime(existing.modifiedAt)} />
                <SummaryValue label="Editor" value={existing.editorName || '—'} />
                <SummaryValue label="Last change" value={existing.changeSummary || '—'} />
              </dl>
            ) : (
              <p className="empty-copy">
                History will begin when this requirement is created.
              </p>
            )}
          </Section>
        </aside>

      {!isNew && reqId && activeTab === 'traceability' && (
        <div
          id="requirement-panel-traceability"
          className="requirement-tab-panel space-y-3"
          role="tabpanel"
          aria-labelledby="requirement-tab-traceability"
        >
          <TabPageIntro
            title="Traceability"
            description="Understand how this requirement connects to other requirements and planned test coverage."
            metrics={[
              { label: 'Relationships', count: relationships.length },
              { label: 'Sources', count: sourceLinks.length },
              { label: 'Test activities', count: activityLinks.length },
              { label: 'Watch items', count: linkedWatchItems.length },
            ]}
          />
          <Section
            id="relationships"
            title="Relationships"
            description="Incoming and outgoing links to other requirements."
            action={
              editing ? (
                <button type="button" className="btn btn-secondary" onClick={() => setRelOpen(true)}>
                  Add Relationship
                </button>
              ) : null
            }
          >
            {relationshipRows.length === 0 ? (
              <p className="empty-copy">No relationships.</p>
            ) : (
              <DataTable
                data={relationshipRows}
                columns={relationshipColumns}
                getRowId={(row) => row.id}
                pageSize={25}
                urlStateKey="relationships"
                maxHeightClassName="max-h-[50vh]"
                sizingStorageKey="requirement-relationships"
                emptyMessage="No relationships match the current column filters."
              />
            )}
          </Section>

          <Section
            id="sources"
            title="Sources"
            description="Documents, standards, policies, interviews, and other origins connected to this requirement."
            action={
              editing ? (
                (project.sources ?? []).length > 0 ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setEditingSourceLink(null)
                      setSourceLinkOpen(true)
                    }}
                  >
                    Link Source
                  </button>
                ) : (
                  <Link className="btn btn-secondary" to="/sources/new">
                    Create Source
                  </Link>
                )
              ) : null
            }
          >
            {sourceLinkRows.length === 0 ? (
              <p className="empty-copy">No linked sources.</p>
            ) : (
              <DataTable
                data={sourceLinkRows}
                columns={sourceLinkColumns}
                getRowId={(row) => row.id}
                pageSize={25}
                urlStateKey="sources"
                maxHeightClassName="max-h-[50vh]"
                sizingStorageKey="requirement-sources"
                emptyMessage="No linked sources match the current column filters."
              />
            )}
          </Section>

          <Section
            id="test-activities"
            title="Test Activities"
            description="Planned test activities that exercise this requirement."
            action={
              editing ? (
                <ActivityLinker
                  activities={project.testActivities}
                  onLink={(activityId, notes) => linkRequirementActivity(reqId, activityId, notes)}
                />
              ) : null
            }
          >
            {activityLinks.length === 0 ? (
              <p className="empty-copy">No linked test activities.</p>
            ) : (
              <ul className="space-y-2">
                {activityLinks.map((link) => {
                  const activity = project.testActivities.find((t) => t.id === link.testActivityId)
                  return (
                    <li key={link.id} className="record-card">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <Link className="font-semibold text-[var(--color-accent)] hover:underline" to="/activities">
                            {activity?.title || 'Missing activity'}
                          </Link>
                          <div className="text-xs text-[var(--color-ink-muted)]">
                            {lookupLabel(project.lookups.testPhases, activity?.phaseId || '')} ·{' '}
                            {lookupLabel(project.lookups.testActivityStatuses, activity?.statusId || '')} ·{' '}
                            {activity?.owner || 'No owner'}
                          </div>
                          {link.notes && <p className="mt-1 text-sm">{link.notes}</p>}
                        </div>
                        {editing && (
                          <button type="button" className="btn btn-ghost btn-sm btn-ghost-danger" onClick={() => unlinkRequirementActivity(link.id)}>
                            Unlink
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>

          <Section
            id="watch-items"
            title="Watch Items"
            description="Standalone watch topics linked to this requirement."
            action={
              editing ? (
                <Link className="btn btn-secondary" to={`/watch-items/new?requirement=${reqId}`}>
                  New Watch Item
                </Link>
              ) : null
            }
          >
            {linkedWatchItems.length === 0 ? (
              <p className="empty-copy">No watch items are linked.</p>
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
          </Section>
        </div>
      )}

      {!isNew && reqId && activeTab === 'verification' && (
        <div
          id="requirement-panel-verification"
          className="requirement-tab-panel space-y-3"
          role="tabpanel"
          aria-labelledby="requirement-tab-verification"
        >
          <TabPageIntro
            title="Verification & evidence"
            description="Review verification progress, supporting evidence, and the assessment history."
            metrics={[
              { label: 'Verification records', count: verifications.length },
              { label: 'Evidence references', count: (form.evidenceIds || []).length },
              { label: 'Assessments', count: assessments.length },
            ]}
          />
          <Section
            id="verification"
            title="Verification"
            description="Methods, status, and notes used to verify the requirement."
            action={
              editing ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    upsertVerification(
                      {
                        requirementId: reqId,
                        methodId: project.lookups.verificationMethods[0]?.id || '',
                        statusId: project.lookups.verificationStatuses[0]?.id || '',
                        assessmentResultId:
                          project.lookups.assessmentResults.find((a) => a.value === 'Not Yet Assessed')?.id || '',
                      },
                      editorName || project.metadata.editorNameDefault,
                    )
                  }}
                >
                  Add Verification
                </button>
              ) : null
            }
          >
            {verifications.length === 0 ? (
              <p className="empty-copy">No verification records.</p>
            ) : (
              <div className="space-y-3">
                {verifications.map((v) => (
                  <div key={v.id} className="record-card">
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Method">
                        <select
                          className="field-input"
                          disabled={!editing}
                          value={v.methodId}
                          onChange={(e) =>
                            upsertVerification({ ...v, methodId: e.target.value }, editorName || project.metadata.editorNameDefault)
                          }
                        >
                          {project.lookups.verificationMethods.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.value}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Status">
                        <select
                          className="field-input"
                          disabled={!editing}
                          value={v.statusId}
                          onChange={(e) =>
                            upsertVerification({ ...v, statusId: e.target.value }, editorName || project.metadata.editorNameDefault)
                          }
                        >
                          {project.lookups.verificationStatuses.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.value}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Linked activity">
                        <select
                          className="field-input"
                          disabled={!editing}
                          value={v.testActivityId || ''}
                          onChange={(e) =>
                            upsertVerification(
                              { ...v, testActivityId: e.target.value || null },
                              editorName || project.metadata.editorNameDefault,
                            )
                          }
                        >
                          <option value="">—</option>
                          {project.testActivities.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.title}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <div className="mt-3">
                      <Field label="Verification notes">
                        {editing ? (
                          <RichTextEditor
                            value={v.notes}
                            onChange={(html) =>
                              upsertVerification({ ...v, notes: html }, editorName || project.metadata.editorNameDefault)
                            }
                          />
                        ) : (
                          <RichTextView html={v.notes} />
                        )}
                      </Field>
                    </div>
                    {editing && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-ghost-danger mt-2"
                        onClick={() => deleteVerification(v.id)}
                      >
                        Delete verification
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3">
              <Field label="Requirement verification notes">
                {editing ? (
                  <RichTextEditor value={form.verificationNotes || ''} onChange={(html) => patch('verificationNotes', html)} />
                ) : (
                  <RichTextView html={form.verificationNotes || ''} />
                )}
              </Field>
            </div>
          </Section>

          <Section
            id="evidence"
            title="Evidence References"
            description="Files and source material that substantiate this requirement."
            action={
              editing ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    const filePath = window.prompt('Evidence file path')
                    if (!filePath?.trim()) return
                    const evidenceId = upsertEvidence({
                      filePath: filePath.trim(),
                      title: window.prompt('Evidence title') || '',
                      evidenceType: project.lookups.evidenceTypes[0]?.id || '',
                    })
                    const nextIds = [...(form.evidenceIds || []), evidenceId]
                    patch('evidenceIds', nextIds)
                    if (!isNew && existing) {
                      upsertRequirement(
                        {
                          ...existing,
                          ...form,
                          evidenceIds: nextIds,
                          sourceId: form.sourceId || existing.sourceId,
                          requirementText: form.requirementText || existing.requirementText,
                          statusId: form.statusId || existing.statusId,
                          classificationId: form.classificationId || existing.classificationId,
                        },
                        {
                          editorName: editorName || project.metadata.editorNameDefault || 'Editor',
                          changeSummary: changeSummary || 'Added evidence reference',
                          isNew: false,
                        },
                      )
                    }
                  }}
                >
                  Add Evidence Path
                </button>
              ) : null
            }
          >
            {(form.evidenceIds || []).length === 0 ? (
              <p className="empty-copy">No evidence references.</p>
            ) : (
              <ul className="space-y-2">
                {(form.evidenceIds || []).map((eid) => {
                  const ev = project.evidence.find((e) => e.id === eid)
                  if (!ev) return <li key={eid}>Missing evidence {eid}</li>
                  return (
                    <li key={eid} className="record-card text-sm">
                      <div className="font-semibold">{ev.title || ev.fileName || 'Evidence'}</div>
                      <div className="break-all text-[var(--color-ink-muted)]">{ev.filePath}</div>
                      <div className="text-xs">
                        {lookupLabel(project.lookups.evidenceTypes, ev.evidenceType)}
                        {ev.sectionOrPage ? ` · ${ev.sectionOrPage}` : ''}
                      </div>
                      {ev.notes && <p className="mt-1">{ev.notes}</p>}
                      {editing && (
                        <button
                          type="button"
                          className="btn btn-ghost mt-2 px-2 py-1 text-xs"
                          onClick={() => patch('evidenceIds', (form.evidenceIds || []).filter((x) => x !== eid))}
                        >
                          Remove from requirement
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>

          <Section
            id="assessments"
            title="Assessments"
            description="Assessment history, with the current result surfaced first."
            action={
              editing ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    upsertAssessment({
                      requirementId: reqId,
                      resultId:
                        project.lookups.assessmentResults.find((a) => a.value === 'Not Yet Assessed')?.id ||
                        project.lookups.assessmentResults[0]?.id ||
                        '',
                      narrative: '',
                      assessorName: editorName || project.metadata.editorNameDefault,
                      isCurrent: true,
                    })
                  }}
                >
                  Add Assessment
                </button>
              ) : null
            }
          >
            {assessments.length === 0 ? (
              <p className="empty-copy">No assessments recorded.</p>
            ) : (
              <div className="space-y-3">
                {assessments.map((a) => (
                  <div key={a.id} className="record-card">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <AssessmentBadge value={lookupLabel(project.lookups.assessmentResults, a.resultId)} />
                      {a.isCurrent && <span className="badge border-slate-300 bg-slate-50">Current</span>}
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Result">
                        <select
                          className="field-input"
                          disabled={!editing}
                          value={a.resultId}
                          onChange={(e) => upsertAssessment({ ...a, resultId: e.target.value })}
                        >
                          {project.lookups.assessmentResults.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.value}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Assessor">
                        <input
                          className="field-input"
                          disabled={!editing}
                          value={a.assessorName}
                          onChange={(e) => upsertAssessment({ ...a, assessorName: e.target.value })}
                        />
                      </Field>
                      <Field label="Assessment date">
                        <input
                          type="date"
                          className="field-input"
                          disabled={!editing}
                          value={a.assessmentDate}
                          onChange={(e) => upsertAssessment({ ...a, assessmentDate: e.target.value })}
                        />
                      </Field>
                    </div>
                    <div className="mt-3">
                      <Field label="Narrative">
                        {editing ? (
                          <RichTextEditor value={a.narrative} onChange={(html) => upsertAssessment({ ...a, narrative: html })} />
                        ) : (
                          <RichTextView html={a.narrative} />
                        )}
                      </Field>
                    </div>
                    {editing && (
                      <div className="mt-2 flex gap-2">
                        {!a.isCurrent && (
                          <button
                            type="button"
                            className="btn btn-secondary text-xs"
                            onClick={() => upsertAssessment({ ...a, isCurrent: true })}
                          >
                            Set as current
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-ghost-danger"
                          onClick={() => deleteAssessment(a.id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}
      </div>

      <Modal
        open={relOpen}
        title="Add Relationship"
        onClose={() => setRelOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setRelOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (!reqId || !relDraft.targetRequirementId) return
                const result = upsertRelationship({
                  sourceRequirementId: reqId,
                  targetRequirementId: relDraft.targetRequirementId,
                  type: relDraft.type,
                  rationale: relDraft.rationale,
                  notes: relDraft.notes,
                  editorName: editorName || project.metadata.editorNameDefault,
                })
                if (!result.ok) {
                  setToast(result.error || 'Could not create relationship')
                  return
                }
                if (result.warning) setToast(result.warning)
                setRelOpen(false)
                setRelDraft({ targetRequirementId: '', type: 'Supports', rationale: '', notes: '' })
              }}
            >
              Add
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Related requirement">
            <FuzzySelect
              options={project.requirements
                .filter((r) => r.id !== reqId)
                .map((r) => ({
                  id: r.id,
                  label: `${r.sourceId} — ${r.shortTitle || 'Untitled'}`,
                }))}
              value={relDraft.targetRequirementId}
              onChange={(targetRequirementId) =>
                setRelDraft((d) => ({ ...d, targetRequirementId }))
              }
              placeholder="Search requirements…"
              emptyLabel="Select…"
              allowClear
            />
          </Field>
          <Field label="Relationship type">
            <select
              className="field-input"
              value={relDraft.type}
              onChange={(e) => setRelDraft((d) => ({ ...d, type: e.target.value as RelationshipType }))}
            >
              {RELATIONSHIP_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Rationale">
            <textarea
              className="field-input"
              rows={3}
              value={relDraft.rationale}
              onChange={(e) => setRelDraft((d) => ({ ...d, rationale: e.target.value }))}
            />
          </Field>
          <Field label="Notes">
            <textarea
              className="field-input"
              rows={2}
              value={relDraft.notes}
              onChange={(e) => setRelDraft((d) => ({ ...d, notes: e.target.value }))}
            />
          </Field>
        </div>
      </Modal>

      <RequirementSourceLinkModal
        open={sourceLinkOpen}
        title={editingSourceLink ? 'Edit Source Relationship' : 'Link Source'}
        selectionLabel="Source"
        options={(project.sources ?? []).map((source) => ({
          id: source.id,
          label: `${source.identifier ? `${source.identifier} — ` : ''}${source.title}`,
        }))}
        initialLink={editingSourceLink}
        initialSelectedId={editingSourceLink?.sourceId}
        onClose={() => {
          setSourceLinkOpen(false)
          setEditingSourceLink(null)
        }}
        onSave={(draft: RequirementSourceLinkDraft) => {
          if (!reqId) return
          const result = upsertRequirementSourceLink(
            {
              id: draft.id,
              requirementId: reqId,
              sourceId: draft.selectedId,
              type: draft.type,
              locator: draft.locator,
              rationale: draft.rationale,
              notes: draft.notes,
            },
            editorName || project.metadata.editorNameDefault,
          )
          if (!result.ok) {
            setToast(result.error || 'Could not save source relationship.')
            return
          }
          setToast(result.warning || 'Source relationship saved.')
          setSourceLinkOpen(false)
          setEditingSourceLink(null)
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Permanently delete requirement?"
        danger
        confirmLabel="Delete Permanently"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!reqId) return
          const next = new URLSearchParams(requirementListParams)
          const remainingSelectedIds = next
            .getAll('selected')
            .filter((selectedId) => selectedId !== reqId)
          next.delete('selected')
          remainingSelectedIds.forEach((selectedId) => next.append('selected', selectedId))
          deleteRequirement(reqId, editorName || project.metadata.editorNameDefault)
          const search = next.toString()
          navigate(`/requirements${search ? `?${search}` : ''}`)
        }}
        message={
          <div>
            <p>
              Delete <strong>{form.sourceId}</strong> and remove related relationships, activity links,
              verifications, and assessments?
            </p>
            <p className="mt-2">This cannot be undone.</p>
          </div>
        }
      />
    </div>
  )
}

function DetailContent({ html, prominent = false }: { html: string; prominent?: boolean }) {
  return (
    <RichTextOrEmpty
      html={html}
      className={prominent ? 'requirement-statement' : 'text-[0.8rem] leading-relaxed'}
    />
  )
}

function DetailGroup({ label, html }: { label: string; html: string }) {
  return (
    <div className="detail-group">
      <div className="detail-group-label">{label}</div>
      <DetailContent html={html} />
    </div>
  )
}

function TagPicker({
  categories,
  tags,
  selectedIds,
  onChange,
}: {
  categories: TagCategory[]
  tags: Tag[]
  selectedIds: string[]
  onChange: (tagIds: string[]) => void
}) {
  const activeCategories = categories
    .filter((category) => category.active)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  if (!activeCategories.some((category) => tags.some((tag) => tag.categoryId === category.id && tag.active))) {
    return <p className="text-xs italic text-[var(--color-ink-muted)]">No tags configured.</p>
  }

  return (
    <div className="space-y-2">
      {activeCategories.map((category) => {
        const categoryTags = tags
          .filter((tag) => tag.categoryId === category.id && tag.active)
          .sort((a, b) => a.sortOrder - b.sortOrder)
        if (!categoryTags.length) return null
        return (
          <div key={category.id} className="tag-group">
            <div className="mb-1 text-[0.62rem] font-bold uppercase tracking-[0.04em] text-[var(--color-ink-muted)]">
              {category.name}
            </div>
            <div className="space-y-1">
              {categoryTags.map((tag) => (
                <label key={tag.id} className="flex items-center gap-2 text-[0.78rem]">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(tag.id)}
                    onChange={(event) => {
                      const nextIds = new Set(selectedIds)
                      if (event.target.checked) nextIds.add(tag.id)
                      else nextIds.delete(tag.id)
                      onChange(Array.from(nextIds))
                    }}
                  />
                  {tag.name}
                </label>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TagSummary({
  categories,
  tags,
  selectedIds,
}: {
  categories: TagCategory[]
  tags: Tag[]
  selectedIds: string[]
}) {
  const selectedTags = selectedIds
    .map((id) => tags.find((tag) => tag.id === id))
    .filter((tag): tag is Tag => Boolean(tag))

  return (
    <div>
      <div className="field-label">Tags</div>
      {selectedTags.length ? (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tag) => {
            const category = categories.find((item) => item.id === tag.categoryId)
            return (
              <span key={tag.id} className="tag-chip" title={category?.name}>
                {tag.name}
              </span>
            )
          })}
        </div>
      ) : (
        <p className="text-xs italic text-[var(--color-ink-muted)]">No tags assigned.</p>
      )}
    </div>
  )
}

function RequirementTabButton({
  id,
  label,
  description,
  count,
  activeTab,
  onSelect,
}: {
  id: RequirementTab
  label: string
  description: string
  count?: number
  activeTab: RequirementTab
  onSelect: (tab: RequirementTab) => void
}) {
  const active = activeTab === id
  return (
    <button
      type="button"
      id={`requirement-tab-${id}`}
      className="requirement-tab"
      role="tab"
      aria-selected={active}
      aria-controls={`requirement-panel-${id}`}
      onClick={() => onSelect(id)}
    >
      <span className="requirement-tab-copy">
        <span className="requirement-tab-label">{label}</span>
        <span className="requirement-tab-description">{description}</span>
      </span>
      {count !== undefined && <span className="requirement-tab-count">{count}</span>}
    </button>
  )
}

function TabPageIntro({
  title,
  description,
  metrics,
}: {
  title: string
  description: string
  metrics: { label: string; count: number }[]
}) {
  return (
    <section className="panel tab-page-intro">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <dl className="tab-page-metrics">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>{metric.count}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function ActivityLinker({
  activities,
  onLink,
}: {
  activities: { id: string; title: string }[]
  onLink: (activityId: string, notes: string) => void
}) {
  const [activityId, setActivityId] = useState('')
  const [notes, setNotes] = useState('')
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[14rem] flex-1">
        <FuzzySelect
          options={activities.map((activity) => ({
            id: activity.id,
            label: activity.title,
          }))}
          value={activityId}
          onChange={setActivityId}
          placeholder="Search activities…"
          emptyLabel="Link activity…"
          allowClear
        />
      </div>
      <input
        className="field-input w-48"
        placeholder="Requirement-specific notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <button
        type="button"
        className="btn btn-secondary"
        disabled={!activityId}
        onClick={() => {
          onLink(activityId, notes)
          setActivityId('')
          setNotes('')
        }}
      >
        Link
      </button>
    </div>
  )
}
