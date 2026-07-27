import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore'
import { RichTextEditor, RichTextView } from '../components/RichText'
import { AssessmentBadge, ClassificationBadge, StatusBadge } from '../components/StatusBadge'
import { ConfirmDialog, Modal } from '../components/Modal'
import { lookupLabel } from '../lib/defaults'
import { formatDateTime } from '../lib/ids'
import { RECIPROCAL_RELATIONSHIP, RELATIONSHIP_TYPES, type RelationshipType, type Requirement } from '../types/project'
import { currentAssessment } from '../lib/filters'

function emptyReq(projectDefaults: { statusId: string; classificationId: string }): Partial<Requirement> {
  return {
    sourceId: '',
    shortTitle: '',
    requirementText: '',
    statusId: projectDefaults.statusId,
    classificationId: projectDefaults.classificationId,
    sourceDocument: '',
    sourceDocumentVersion: '',
    sourceSection: '',
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
  const linkRequirementActivity = useProjectStore((s) => s.linkRequirementActivity)
  const unlinkRequirementActivity = useProjectStore((s) => s.unlinkRequirementActivity)
  const upsertEvidence = useProjectStore((s) => s.upsertEvidence)
  const upsertVerification = useProjectStore((s) => s.upsertVerification)
  const deleteVerification = useProjectStore((s) => s.deleteVerification)
  const upsertAssessment = useProjectStore((s) => s.upsertAssessment)
  const deleteAssessment = useProjectStore((s) => s.deleteAssessment)
  const setGraphFocus = useProjectStore((s) => s.setGraphFocus)
  const setToast = useProjectStore((s) => s.setToast)

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
  const [relDraft, setRelDraft] = useState({
    targetRequirementId: '',
    type: 'Supports' as RelationshipType,
    rationale: '',
    notes: '',
  })

  useEffect(() => {
    if (existing) {
      setForm(existing)
      setEditorName(project.metadata.editorNameDefault || existing.editorName || '')
      setChangeSummary('')
    } else if (isNew) {
      setForm(emptyReq({ statusId: defaultStatus, classificationId: defaultClass }))
    }
  }, [existing, isNew, defaultStatus, defaultClass, project.metadata.editorNameDefault])

  if (!isNew && !existing) {
    return (
      <div className="panel p-6">
        <p>Requirement not found.</p>
        <Link className="btn btn-secondary mt-3" to="/requirements">
          Back to list
        </Link>
      </div>
    )
  }

  const reqId = existing?.id
  const relationships = project.relationships.filter(
    (r) => r.sourceRequirementId === reqId || r.targetRequirementId === reqId,
  )
  const activityLinks = project.requirementActivityLinks.filter((l) => l.requirementId === reqId)
  const verifications = project.verifications.filter((v) => v.requirementId === reqId)
  const assessments = project.assessments
    .filter((a) => a.requirementId === reqId)
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
  const current = reqId ? currentAssessment(project, reqId) : undefined

  const save = () => {
    const result = upsertRequirement(
      {
        ...form,
        id: existing?.id,
        sourceId: form.sourceId || '',
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
      setToast(isNew ? 'Requirement created (local autosave).' : 'Requirement updated (local autosave).')
      navigate(`/requirements/${result.id}`, { replace: true })
    }
  }

  const patch = <K extends keyof Requirement>(key: K, value: Requirement[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2">
            <Link to="/requirements" className="text-sm text-[var(--color-accent)] hover:underline">
              ← Requirements
            </Link>
          </div>
          <h2 className="page-title">
            {isNew ? 'New Requirement' : form.sourceId}
          </h2>
          {!isNew && (
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge value={lookupLabel(project.lookups.statuses, form.statusId || '')} />
              <ClassificationBadge value={lookupLabel(project.lookups.classifications, form.classificationId || '')} />
              {current && (
                <AssessmentBadge value={lookupLabel(project.lookups.assessmentResults, current.resultId)} />
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {reqId && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setGraphFocus(reqId)
                  navigate('/graph')
                }}
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
      </div>

      {errors.length > 0 && (
        <div className="panel border-[var(--color-danger)] bg-[var(--color-danger-bg)] p-3 text-sm text-[var(--color-danger)]">
          <ul className="list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="panel grid gap-2.5 p-2.5 md:grid-cols-2">
        <Field label="Source requirement ID" required>
          <input
            className="field-input"
            disabled={!editing}
            value={form.sourceId || ''}
            onChange={(e) => patch('sourceId', e.target.value)}
          />
        </Field>
        <Field label="Short title">
          <input
            className="field-input"
            disabled={!editing}
            value={form.shortTitle || ''}
            onChange={(e) => patch('shortTitle', e.target.value)}
          />
        </Field>
        <Field label="Status" required>
          <select
            className="field-input"
            disabled={!editing}
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
            disabled={!editing}
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
            disabled={!editing}
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
            disabled={!editing}
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
        <div className="md:col-span-2">
          <Field label="Requirement text" required>
            {editing ? (
              <RichTextEditor value={form.requirementText || ''} onChange={(html) => patch('requirementText', html)} />
            ) : (
              <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2">
                <RichTextView html={form.requirementText || ''} />
              </div>
            )}
          </Field>
        </div>
        <Field label="Source document">
          <input className="field-input" disabled={!editing} value={form.sourceDocument || ''} onChange={(e) => patch('sourceDocument', e.target.value)} />
        </Field>
        <Field label="Source document version">
          <input className="field-input" disabled={!editing} value={form.sourceDocumentVersion || ''} onChange={(e) => patch('sourceDocumentVersion', e.target.value)} />
        </Field>
        <Field label="Source section / paragraph">
          <input className="field-input" disabled={!editing} value={form.sourceSection || ''} onChange={(e) => patch('sourceSection', e.target.value)} />
        </Field>
        <Field label="Derived requirement">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={!editing}
              checked={Boolean(form.isDerived)}
              onChange={(e) => patch('isDerived', e.target.checked)}
            />
            Mark as derived
          </label>
        </Field>
        <div className="md:col-span-2">
          <Field label="Description">
            {editing ? (
              <RichTextEditor value={form.description || ''} onChange={(html) => patch('description', html)} />
            ) : (
              <RichTextView html={form.description || ''} />
            )}
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Analyst notes">
            {editing ? (
              <RichTextEditor value={form.analystNotes || ''} onChange={(html) => patch('analystNotes', html)} />
            ) : (
              <RichTextView html={form.analystNotes || ''} />
            )}
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Requirement rationale">
            {editing ? (
              <RichTextEditor value={form.rationale || ''} onChange={(html) => patch('rationale', html)} />
            ) : (
              <RichTextView html={form.rationale || ''} />
            )}
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Tags">
            <div className="grid gap-2 sm:grid-cols-2">
              {project.tagCategories
                .filter((c) => c.active)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((cat) => {
                  const tags = project.tags.filter((t) => t.categoryId === cat.id && t.active)
                  if (!tags.length) return null
                  return (
                    <div key={cat.id} className="rounded-md border border-[var(--color-line)] p-2">
                      <div className="mb-1 text-xs font-bold uppercase text-[var(--color-ink-muted)]">{cat.name}</div>
                      <div className="flex flex-col gap-1">
                        {tags.map((tag) => (
                          <label key={tag.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              disabled={!editing}
                              checked={(form.tagIds || []).includes(tag.id)}
                              onChange={(e) => {
                                const set = new Set(form.tagIds || [])
                                if (e.target.checked) set.add(tag.id)
                                else set.delete(tag.id)
                                patch('tagIds', Array.from(set))
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
          </Field>
        </div>
        {editing && (
          <>
            <Field label="Editor name" required={!isNew}>
              <input className="field-input" value={editorName} onChange={(e) => setEditorName(e.target.value)} />
            </Field>
            <Field label="Change summary" required={!isNew}>
              <input className="field-input" value={changeSummary} onChange={(e) => setChangeSummary(e.target.value)} />
            </Field>
          </>
        )}
        {!isNew && existing && (
          <div className="md:col-span-2 text-xs text-[var(--color-ink-muted)]">
            Created {formatDateTime(existing.createdAt)} · Last modified {formatDateTime(existing.modifiedAt)} by{' '}
            {existing.editorName || '—'} · {existing.changeSummary || '—'}
          </div>
        )}
      </section>

      {!isNew && reqId && (
        <>
          <Section
            title="Relationships"
            action={
              editing ? (
                <button type="button" className="btn btn-secondary" onClick={() => setRelOpen(true)}>
                  Add Relationship
                </button>
              ) : null
            }
          >
            {relationships.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-muted)]">No relationships.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Related ID</th>
                      <th>Title</th>
                      <th>Direction</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Rationale</th>
                      {editing && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {relationships.map((rel) => {
                      const outgoing = rel.sourceRequirementId === reqId
                      const otherId = outgoing ? rel.targetRequirementId : rel.sourceRequirementId
                      const other = project.requirements.find((r) => r.id === otherId)
                      const displayType =
                        outgoing ? rel.type : RECIPROCAL_RELATIONSHIP[rel.type] || rel.type
                      return (
                        <tr key={rel.id}>
                          <td>
                            <Link className="text-[var(--color-accent)] hover:underline" to={`/requirements/${otherId}`}>
                              {other?.sourceId || 'Missing'}
                            </Link>
                          </td>
                          <td>{other?.shortTitle || '—'}</td>
                          <td>{outgoing ? 'Outgoing' : 'Incoming'}</td>
                          <td>{displayType}</td>
                          <td>
                            <StatusBadge value={lookupLabel(project.lookups.statuses, other?.statusId || '')} />
                          </td>
                          <td>{rel.rationale || '—'}</td>
                          {editing && (
                            <td>
                              <button
                                type="button"
                                className="btn btn-ghost px-2 py-1 text-xs text-[var(--color-danger)]"
                                onClick={() => deleteRelationship(rel.id)}
                              >
                                Remove
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section
            title="Test Activities"
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
              <p className="text-sm text-[var(--color-ink-muted)]">No linked test activities.</p>
            ) : (
              <ul className="space-y-2">
                {activityLinks.map((link) => {
                  const activity = project.testActivities.find((t) => t.id === link.testActivityId)
                  return (
                    <li key={link.id} className="rounded-md border border-[var(--color-line)] p-3">
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
                          <button type="button" className="btn btn-ghost text-xs text-[var(--color-danger)]" onClick={() => unlinkRequirementActivity(link.id)}>
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
            title="Verification"
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
              <p className="text-sm text-[var(--color-ink-muted)]">No verification records.</p>
            ) : (
              <div className="space-y-3">
                {verifications.map((v) => (
                  <div key={v.id} className="rounded-md border border-[var(--color-line)] p-3">
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
                        className="btn btn-ghost mt-2 text-xs text-[var(--color-danger)]"
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
            title="Evidence References"
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
              <p className="text-sm text-[var(--color-ink-muted)]">No evidence references.</p>
            ) : (
              <ul className="space-y-2">
                {(form.evidenceIds || []).map((eid) => {
                  const ev = project.evidence.find((e) => e.id === eid)
                  if (!ev) return <li key={eid}>Missing evidence {eid}</li>
                  return (
                    <li key={eid} className="rounded-md border border-[var(--color-line)] p-3 text-sm">
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
            title="Assessments"
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
              <p className="text-sm text-[var(--color-ink-muted)]">No assessments recorded.</p>
            ) : (
              <div className="space-y-3">
                {assessments.map((a) => (
                  <div key={a.id} className="rounded-md border border-[var(--color-line)] p-3">
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
                          className="btn btn-ghost text-xs text-[var(--color-danger)]"
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
        </>
      )}

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
            <select
              className="field-input"
              value={relDraft.targetRequirementId}
              onChange={(e) => setRelDraft((d) => ({ ...d, targetRequirementId: e.target.value }))}
            >
              <option value="">Select…</option>
              {project.requirements
                .filter((r) => r.id !== reqId)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.sourceId} — {r.shortTitle || 'Untitled'}
                  </option>
                ))}
            </select>
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

      <ConfirmDialog
        open={confirmDelete}
        title="Permanently delete requirement?"
        danger
        confirmLabel="Delete Permanently"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!reqId) return
          deleteRequirement(reqId)
          navigate('/requirements')
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

function Field({
  label,
  children,
  required,
}: {
  label: string
  children: ReactNode
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="field-label">
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
    </label>
  )
}

function Section({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="panel p-2.5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        {action}
      </div>
      {children}
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
      <select className="field-input w-auto" value={activityId} onChange={(e) => setActivityId(e.target.value)}>
        <option value="">Link activity…</option>
        {activities.map((a) => (
          <option key={a.id} value={a.id}>
            {a.title}
          </option>
        ))}
      </select>
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
