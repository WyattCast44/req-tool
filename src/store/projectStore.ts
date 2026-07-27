import { create } from 'zustand'
import {
  DEFAULT_COLUMNS,
  SCHEMA_VERSION,
  emptyFilters,
  type AssessmentRecord,
  type EvidenceReference,
  type LookupValue,
  type Lookups,
  type ProjectData,
  type ProjectMode,
  type ProjectStateLabel,
  type Requirement,
  type RequirementActivityLink,
  type RequirementRelationship,
  type RequirementSourceLink,
  type SavedView,
  type Source,
  type SourceRelationshipType,
  type Tag,
  type TagCategory,
  type TestActivity,
  type VerificationRecord,
} from '../types/project'
import { createEmptyProject } from '../lib/defaults'
import { createSampleProject } from '../lib/sampleProject'
import { clearActivePointer, deleteWorkspace, getActiveWorkspace, saveWorkspace } from '../lib/idb'
import { downloadTextFile, exportFilename, prepareExportProject } from '../lib/export'
import {
  findDuplicateRelationship,
  parseAndValidateProject,
  validateRequirementDraft,
} from '../lib/validate'
import { newId, nowIso } from '../lib/ids'
import { ensureLinkSafety } from '../lib/sanitize'

interface ProjectStore {
  project: ProjectData | null
  mode: ProjectMode
  hasUnexportedChanges: boolean
  localSavedAt: string | null
  sourceFileName: string | null
  recoveryAvailable: boolean
  hydrated: boolean
  lastExportNotice: boolean
  toast: string | null
  loadIssues: string[]

  stateLabel: () => ProjectStateLabel
  hydrate: () => Promise<void>
  setToast: (message: string | null) => void

  createProject: (name?: string, sample?: boolean) => Promise<void>
  importProjectFile: (file: File) => Promise<{ ok: boolean; messages: string[] }>
  discardLocalAndClear: () => Promise<void>
  exportProject: () => Promise<void>

  enterEditMode: () => void
  exitEditMode: () => void
  setEditorNameDefault: (name: string) => void

  updateProjectMeta: (patch: Partial<ProjectData['metadata']>) => void

  upsertRequirement: (
    input: Partial<Requirement> & { sourceId: string; requirementText: string; statusId: string; classificationId: string },
    options: { editorName: string; changeSummary: string; isNew: boolean },
  ) => { ok: boolean; errors: string[]; id?: string }
  duplicateRequirement: (id: string, editorName: string) => string | null
  deleteRequirement: (id: string) => void

  upsertRelationship: (
    input: Omit<RequirementRelationship, 'id' | 'createdAt' | 'modifiedAt'> & { id?: string },
  ) => { ok: boolean; warning?: string; error?: string; id?: string }
  deleteRelationship: (id: string) => void

  upsertSource: (input: Partial<Source> & { title: string; id?: string }, editorName: string) => { ok: boolean; error?: string; id?: string }
  deleteSource: (id: string) => void
  upsertRequirementSourceLink: (
    input: Partial<RequirementSourceLink> & {
      requirementId: string
      sourceId: string
      type: SourceRelationshipType
      id?: string
    },
    editorName: string,
  ) => { ok: boolean; error?: string; warning?: string; id?: string }
  deleteRequirementSourceLink: (id: string) => void

  upsertTestActivity: (input: Partial<TestActivity> & { title: string; id?: string }, editorName: string) => string
  deleteTestActivity: (id: string) => void
  linkRequirementActivity: (requirementId: string, testActivityId: string, notes: string) => void
  unlinkRequirementActivity: (linkId: string) => void

  upsertEvidence: (input: Partial<EvidenceReference> & { filePath: string; id?: string }) => string
  deleteEvidence: (id: string) => void

  upsertVerification: (input: Partial<VerificationRecord> & { requirementId: string; id?: string }, editorName: string) => string
  deleteVerification: (id: string) => void

  upsertAssessment: (input: Partial<AssessmentRecord> & { requirementId: string; resultId: string; id?: string }) => string
  deleteAssessment: (id: string) => void

  upsertTagCategory: (input: Partial<TagCategory> & { name: string; id?: string }) => string
  deleteTagCategory: (id: string, mode: 'block' | 'reassign' | 'clear', reassignTo?: string) => { ok: boolean; message?: string }
  upsertTag: (input: Partial<Tag> & { name: string; categoryId: string; id?: string }) => string
  deleteTag: (id: string, mode: 'block' | 'clear') => { ok: boolean; message?: string }

  upsertLookup: (key: keyof Lookups, input: Partial<LookupValue> & { value: string; id?: string }) => { ok: boolean; warning?: string; id?: string }
  deleteLookup: (key: keyof Lookups, id: string, mode: 'block' | 'reassign', reassignTo?: string) => { ok: boolean; message?: string }

  upsertSavedView: (input: Partial<SavedView> & { name: string; id?: string }) => string
  deleteSavedView: (id: string) => void

}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => setTimeout(resolve, 0))
    } else {
      setTimeout(resolve, 0)
    }
  })
}

async function persist(get: () => ProjectStore) {
  const state = get()
  if (!state.project) return
  const localSavedAt = nowIso()
  try {
    await saveWorkspace({
      projectId: state.project.metadata.id,
      project: state.project,
      mode: state.mode,
      hasUnexportedChanges: state.hasUnexportedChanges,
      localSavedAt,
      sourceFileName: state.sourceFileName,
    })
    get().localSavedAt = localSavedAt
  } catch (error) {
    console.error('Local autosave failed', error)
    get().setToast(
      'Local browser autosave failed (storage quota or private mode). Export a project file before closing.',
    )
  }
}

function schedulePersist(get: () => ProjectStore, set: (partial: Partial<ProjectStore>) => void) {
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => {
    void persist(get).then(() => {
      set({ localSavedAt: get().localSavedAt })
    })
  }, 400)
}

function touchProject(project: ProjectData): ProjectData {
  return {
    ...project,
    metadata: {
      ...project.metadata,
      modifiedAt: nowIso(),
    },
  }
}

function sanitizeReq(req: Requirement): Requirement {
  return {
    ...req,
    requirementText: ensureLinkSafety(req.requirementText || ''),
    description: ensureLinkSafety(req.description || ''),
    analystNotes: ensureLinkSafety(req.analystNotes || ''),
    rationale: ensureLinkSafety(req.rationale || ''),
    verificationNotes: ensureLinkSafety(req.verificationNotes || ''),
  }
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,
  mode: 'review',
  hasUnexportedChanges: false,
  localSavedAt: null,
  sourceFileName: null,
  recoveryAvailable: false,
  hydrated: false,
  lastExportNotice: false,

  toast: null,
  loadIssues: [],

  stateLabel: () => {
    const s = get()
    if (!s.project && s.recoveryAvailable) return 'Local recovery data available'
    if (s.lastExportNotice && !s.hasUnexportedChanges) return 'Project file exported'
    if (s.hasUnexportedChanges) return 'Local changes saved — export required'
    if (s.mode === 'edit') return 'Edit Mode — no unexported changes'
    return 'Review Mode — no local changes'
  },

  hydrate: async () => {
    const existing = await getActiveWorkspace()
    if (existing) {
      if (existing.project.schemaVersion !== SCHEMA_VERSION) {
        set({
          project: null,
          mode: 'review',
          hasUnexportedChanges: false,
          localSavedAt: existing.localSavedAt,
          sourceFileName: existing.sourceFileName,
          recoveryAvailable: false,
          hydrated: true,
          loadIssues: [
            `Cached workspace uses unsupported schema version ${existing.project.schemaVersion}. Expected v${SCHEMA_VERSION}. The cached data was not loaded or deleted.`,
          ],
        })
        return
      }
      set({
        project: existing.project,
        mode: 'review',
        hasUnexportedChanges: existing.hasUnexportedChanges,
        localSavedAt: existing.localSavedAt,
        sourceFileName: existing.sourceFileName,
        recoveryAvailable: existing.hasUnexportedChanges,
        hydrated: true,
        loadIssues: existing.hasUnexportedChanges
          ? ['Local working changes were recovered from browser storage. Export when ready, or discard and load the authoritative file.']
          : [],
      })
    } else {
      set({ hydrated: true })
    }
  },

  setToast: (message) => set({ toast: message }),

  createProject: async (name, sample = false) => {
    const project = sample ? createSampleProject() : createEmptyProject(name)
    set({
      project,
      mode: 'review',
      hasUnexportedChanges: true,
      sourceFileName: null,
      recoveryAvailable: false,
      lastExportNotice: false,
      loadIssues: [],
    })
    await persist(get)
  },

  importProjectFile: async (file) => {
    try {
      const text = await file.text()
      await yieldToUi()
      const result = parseAndValidateProject(text)
      if (!result.ok || !result.project) {
        return {
          ok: false,
          messages: result.issues.map((i) => `${i.level.toUpperCase()}: ${i.message}`),
        }
      }
      set({
        project: result.project,
        mode: 'review',
        hasUnexportedChanges: false,
        sourceFileName: file.name,
        recoveryAvailable: false,
        lastExportNotice: false,
        loadIssues: result.issues.map((i) => i.message),
      })
      // Defer IndexedDB write so the dashboard can paint first on large projects.
      setTimeout(() => {
        void persist(get)
      }, 0)
      return {
        ok: true,
        messages: result.issues.map((i) => i.message),
      }
    } catch (error) {
      console.error('Import failed', error)
      return {
        ok: false,
        messages: [
          `ERROR: Failed to open project file${error instanceof Error ? `: ${error.message}` : '.'}`,
        ],
      }
    }
  },

  discardLocalAndClear: async () => {
    const project = get().project
    if (project) await deleteWorkspace(project.metadata.id)
    await clearActivePointer()
    set({
      project: null,
      mode: 'review',
      hasUnexportedChanges: false,
      localSavedAt: null,
      sourceFileName: null,
      recoveryAvailable: false,
      lastExportNotice: false,
      loadIssues: [],
    })
  },

  exportProject: async () => {
    const { project } = get()
    if (!project) return
    const editor = project.metadata.editorNameDefault || 'Unknown Editor'
    const exported = prepareExportProject(project, editor)
    downloadTextFile(exportFilename(exported), JSON.stringify(exported, null, 2))
    set({
      project: exported,
      hasUnexportedChanges: false,
      lastExportNotice: true,
      mode: get().mode,
    })
    await persist(get)
    set({ toast: 'Project file exported. Replace the authoritative share copy per SOP.' })
  },

  enterEditMode: () => {
    if (!get().project) return
    set({ mode: 'edit', lastExportNotice: false })
    schedulePersist(get, set)
  },

  exitEditMode: () => {
    set({ mode: 'review' })
    schedulePersist(get, set)
  },

  setEditorNameDefault: (name) => {
    const project = get().project
    if (!project) return
    set({
      project: {
        ...project,
        metadata: { ...project.metadata, editorNameDefault: name },
      },
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
  },

  updateProjectMeta: (patch) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return
    set({
      project: touchProject({
        ...project,
        metadata: { ...project.metadata, ...patch },
      }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
  },

  upsertRequirement: (input, options) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return { ok: false, errors: ['Edit Mode required.'] }
    const errors = validateRequirementDraft(input)
    if (!options.isNew) {
      if (!options.editorName.trim()) errors.push('Editor name is required when modifying a requirement.')
      if (!options.changeSummary.trim()) errors.push('Change summary is required when modifying a requirement.')
    }
    if (errors.length) return { ok: false, errors }

    const ts = nowIso()
    if (options.isNew) {
      const req = sanitizeReq({
        id: newId(),
        sourceId: input.sourceId.trim(),
        shortTitle: input.shortTitle || '',
        requirementText: input.requirementText,
        statusId: input.statusId,
        classificationId: input.classificationId,
        description: input.description || '',
        analystNotes: input.analystNotes || '',
        rationale: input.rationale || '',
        typeId: input.typeId || '',
        priorityId: input.priorityId || '',
        tagIds: input.tagIds || [],
        isDerived: Boolean(input.isDerived),
        verificationNotes: input.verificationNotes || '',
        evidenceIds: input.evidenceIds || [],
        createdAt: ts,
        modifiedAt: ts,
        editorName: options.editorName || project.metadata.editorNameDefault || '',
        changeSummary: options.changeSummary || 'Created requirement',
      })
      set({
        project: touchProject({ ...project, requirements: [...project.requirements, req] }),
        hasUnexportedChanges: true,
        lastExportNotice: false,
      })
      schedulePersist(get, set)
      return { ok: true, errors: [], id: req.id }
    }

    const existing = project.requirements.find((r) => r.id === input.id)
    if (!existing) return { ok: false, errors: ['Requirement not found.'] }
    const updated = sanitizeReq({
      ...existing,
      ...input,
      id: existing.id,
      sourceId: input.sourceId.trim(),
      modifiedAt: ts,
      editorName: options.editorName.trim(),
      changeSummary: options.changeSummary.trim(),
      tagIds: input.tagIds || existing.tagIds,
      evidenceIds: input.evidenceIds || existing.evidenceIds,
    })
    set({
      project: touchProject({
        ...project,
        requirements: project.requirements.map((r) => (r.id === updated.id ? updated : r)),
      }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
    return { ok: true, errors: [], id: updated.id }
  },

  duplicateRequirement: (id, editorName) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return null
    const source = project.requirements.find((r) => r.id === id)
    if (!source) return null
    const ts = nowIso()
    const copy = sanitizeReq({
      ...structuredClone(source),
      id: newId(),
      sourceId: `${source.sourceId}-COPY`,
      shortTitle: source.shortTitle ? `${source.shortTitle} (Copy)` : '',
      createdAt: ts,
      modifiedAt: ts,
      editorName: editorName || project.metadata.editorNameDefault || '',
      changeSummary: `Duplicated from ${source.sourceId}`,
    })
    set({
      project: touchProject({ ...project, requirements: [...project.requirements, copy] }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
    return copy.id
  },

  deleteRequirement: (id) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return
    const cleaned: ProjectData = {
      ...project,
      requirements: project.requirements.filter((r) => r.id !== id),
      relationships: project.relationships.filter(
        (r) => r.sourceRequirementId !== id && r.targetRequirementId !== id,
      ),
      requirementSourceLinks: (project.requirementSourceLinks ?? []).filter((link) => link.requirementId !== id),
      requirementActivityLinks: project.requirementActivityLinks.filter((l) => l.requirementId !== id),
      verifications: project.verifications.filter((v) => v.requirementId !== id),
      assessments: project.assessments.filter((a) => a.requirementId !== id),
    }
    set({
      project: touchProject(cleaned),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
  },

  upsertRelationship: (input) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return { ok: false, error: 'Edit Mode required.' }
    if (input.sourceRequirementId === input.targetRequirementId) {
      return { ok: false, error: 'A requirement cannot be related to itself.' }
    }
    const reqIds = new Set(project.requirements.map((r) => r.id))
    if (!reqIds.has(input.sourceRequirementId) || !reqIds.has(input.targetRequirementId)) {
      return { ok: false, error: 'Relationship source and target must exist.' }
    }
    const dup = findDuplicateRelationship(
      project.relationships,
      input.sourceRequirementId,
      input.targetRequirementId,
      input.type,
      input.id,
    )
    const ts = nowIso()
    if (input.id) {
      const updated: RequirementRelationship = {
        ...project.relationships.find((r) => r.id === input.id)!,
        ...input,
        id: input.id,
        modifiedAt: ts,
      }
      set({
        project: touchProject({
          ...project,
          relationships: project.relationships.map((r) => (r.id === input.id ? updated : r)),
        }),
        hasUnexportedChanges: true,
        lastExportNotice: false,
      })
      schedulePersist(get, set)
      return { ok: true, id: input.id, warning: dup ? 'A similar relationship already exists.' : undefined }
    }
    const rel: RequirementRelationship = {
      id: newId(),
      sourceRequirementId: input.sourceRequirementId,
      targetRequirementId: input.targetRequirementId,
      type: input.type,
      rationale: input.rationale || '',
      notes: input.notes || '',
      createdAt: ts,
      modifiedAt: ts,
      editorName: input.editorName || project.metadata.editorNameDefault || '',
    }
    set({
      project: touchProject({ ...project, relationships: [...project.relationships, rel] }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
    return { ok: true, id: rel.id, warning: dup ? 'A duplicate relationship already exists.' : undefined }
  },

  deleteRelationship: (id) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return
    set({
      project: touchProject({
        ...project,
        relationships: project.relationships.filter((r) => r.id !== id),
      }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
  },

  upsertSource: (input, editorName) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return { ok: false, error: 'Edit Mode required.' }
    if (!input.title.trim()) return { ok: false, error: 'Source title is required.' }
    const ts = nowIso()
    const sources = project.sources ?? []
    if (input.id) {
      const existing = sources.find((source) => source.id === input.id)
      if (!existing) return { ok: false, error: 'Source not found.' }
      const updated: Source = {
        ...existing,
        ...input,
        id: existing.id,
        identifier: input.identifier?.trim() || '',
        title: input.title.trim(),
        description: ensureLinkSafety(input.description || ''),
        notes: ensureLinkSafety(input.notes || ''),
        modifiedAt: ts,
        editorName: editorName || project.metadata.editorNameDefault || existing.editorName,
      }
      set({
        project: touchProject({
          ...project,
          sources: sources.map((source) => (source.id === updated.id ? updated : source)),
        }),
        hasUnexportedChanges: true,
        lastExportNotice: false,
      })
      schedulePersist(get, set)
      return { ok: true, id: updated.id }
    }
    const created: Source = {
      id: newId(),
      identifier: input.identifier?.trim() || '',
      title: input.title.trim(),
      sourceType: input.sourceType?.trim() || '',
      version: input.version?.trim() || '',
      publisher: input.publisher?.trim() || '',
      publicationDate: input.publicationDate || '',
      url: input.url?.trim() || '',
      filePath: input.filePath?.trim() || '',
      description: ensureLinkSafety(input.description || ''),
      notes: ensureLinkSafety(input.notes || ''),
      createdAt: ts,
      modifiedAt: ts,
      editorName: editorName || project.metadata.editorNameDefault || '',
    }
    set({
      project: touchProject({ ...project, sources: [...sources, created] }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
    return { ok: true, id: created.id }
  },

  deleteSource: (id) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return
    set({
      project: touchProject({
        ...project,
        sources: (project.sources ?? []).filter((source) => source.id !== id),
        requirementSourceLinks: (project.requirementSourceLinks ?? []).filter((link) => link.sourceId !== id),
      }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
  },

  upsertRequirementSourceLink: (input, editorName) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return { ok: false, error: 'Edit Mode required.' }
    if (!project.requirements.some((requirement) => requirement.id === input.requirementId)) {
      return { ok: false, error: 'Requirement not found.' }
    }
    if (!(project.sources ?? []).some((source) => source.id === input.sourceId)) {
      return { ok: false, error: 'Source not found.' }
    }
    const links = project.requirementSourceLinks ?? []
    const duplicate = links.find(
      (link) =>
        link.id !== input.id &&
        link.requirementId === input.requirementId &&
        link.sourceId === input.sourceId &&
        link.type === input.type,
    )
    const ts = nowIso()
    if (input.id) {
      const existing = links.find((link) => link.id === input.id)
      if (!existing) return { ok: false, error: 'Source relationship not found.' }
      const updated: RequirementSourceLink = {
        ...existing,
        ...input,
        id: existing.id,
        locator: input.locator?.trim() || '',
        rationale: ensureLinkSafety(input.rationale || ''),
        notes: ensureLinkSafety(input.notes || ''),
        modifiedAt: ts,
        editorName: editorName || project.metadata.editorNameDefault || existing.editorName,
      }
      set({
        project: touchProject({
          ...project,
          requirementSourceLinks: links.map((link) => (link.id === updated.id ? updated : link)),
        }),
        hasUnexportedChanges: true,
        lastExportNotice: false,
      })
      schedulePersist(get, set)
      return {
        ok: true,
        id: updated.id,
        warning: duplicate ? 'A similar requirement–source relationship already exists.' : undefined,
      }
    }
    const created: RequirementSourceLink = {
      id: newId(),
      requirementId: input.requirementId,
      sourceId: input.sourceId,
      type: input.type,
      locator: input.locator?.trim() || '',
      rationale: ensureLinkSafety(input.rationale || ''),
      notes: ensureLinkSafety(input.notes || ''),
      createdAt: ts,
      modifiedAt: ts,
      editorName: editorName || project.metadata.editorNameDefault || '',
    }
    set({
      project: touchProject({ ...project, requirementSourceLinks: [...links, created] }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
    return {
      ok: true,
      id: created.id,
      warning: duplicate ? 'A duplicate requirement–source relationship already exists.' : undefined,
    }
  },

  deleteRequirementSourceLink: (id) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return
    set({
      project: touchProject({
        ...project,
        requirementSourceLinks: (project.requirementSourceLinks ?? []).filter((link) => link.id !== id),
      }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
  },

  upsertTestActivity: (input, editorName) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return ''
    const ts = nowIso()
    if (input.id) {
      const updated: TestActivity = {
        ...project.testActivities.find((t) => t.id === input.id)!,
        ...input,
        id: input.id,
        title: input.title.trim(),
        objectives: ensureLinkSafety(input.objectives || ''),
        dataSources: ensureLinkSafety(input.dataSources || ''),
        notes: ensureLinkSafety(input.notes || ''),
        modifiedAt: ts,
        editorName: editorName || project.metadata.editorNameDefault || '',
      }
      set({
        project: touchProject({
          ...project,
          testActivities: project.testActivities.map((t) => (t.id === input.id ? updated : t)),
        }),
        hasUnexportedChanges: true,
        lastExportNotice: false,
      })
      schedulePersist(get, set)
      return input.id
    }
    const created: TestActivity = {
      id: newId(),
      title: input.title.trim(),
      typeId: input.typeId || '',
      phaseId: input.phaseId || '',
      plannedStart: input.plannedStart || '',
      plannedEnd: input.plannedEnd || '',
      actualStart: input.actualStart || '',
      actualEnd: input.actualEnd || '',
      owner: input.owner || '',
      statusId: input.statusId || '',
      objectives: ensureLinkSafety(input.objectives || ''),
      dataSources: ensureLinkSafety(input.dataSources || ''),
      notes: ensureLinkSafety(input.notes || ''),
      createdAt: ts,
      modifiedAt: ts,
      editorName: editorName || project.metadata.editorNameDefault || '',
    }
    set({
      project: touchProject({ ...project, testActivities: [...project.testActivities, created] }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
    return created.id
  },

  deleteTestActivity: (id) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return
    set({
      project: touchProject({
        ...project,
        testActivities: project.testActivities.filter((t) => t.id !== id),
        requirementActivityLinks: project.requirementActivityLinks.filter((l) => l.testActivityId !== id),
        verifications: project.verifications.map((v) =>
          v.testActivityId === id ? { ...v, testActivityId: null } : v,
        ),
        assessments: project.assessments.map((a) =>
          a.testActivityId === id ? { ...a, testActivityId: null } : a,
        ),
      }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
  },

  linkRequirementActivity: (requirementId, testActivityId, notes) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return
    const existing = project.requirementActivityLinks.find(
      (l) => l.requirementId === requirementId && l.testActivityId === testActivityId,
    )
    if (existing) {
      set({
        project: touchProject({
          ...project,
          requirementActivityLinks: project.requirementActivityLinks.map((l) =>
            l.id === existing.id ? { ...l, notes } : l,
          ),
        }),
        hasUnexportedChanges: true,
        lastExportNotice: false,
      })
    } else {
      const link: RequirementActivityLink = {
        id: newId(),
        requirementId,
        testActivityId,
        notes,
      }
      set({
        project: touchProject({
          ...project,
          requirementActivityLinks: [...project.requirementActivityLinks, link],
        }),
        hasUnexportedChanges: true,
        lastExportNotice: false,
      })
    }
    schedulePersist(get, set)
  },

  unlinkRequirementActivity: (linkId) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return
    set({
      project: touchProject({
        ...project,
        requirementActivityLinks: project.requirementActivityLinks.filter((l) => l.id !== linkId),
      }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
  },

  upsertEvidence: (input) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return ''
    if (input.id) {
      const updated: EvidenceReference = {
        ...project.evidence.find((e) => e.id === input.id)!,
        ...input,
        id: input.id,
        filePath: input.filePath,
      }
      set({
        project: touchProject({
          ...project,
          evidence: project.evidence.map((e) => (e.id === input.id ? updated : e)),
        }),
        hasUnexportedChanges: true,
        lastExportNotice: false,
      })
      schedulePersist(get, set)
      return input.id
    }
    const created: EvidenceReference = {
      id: newId(),
      filePath: input.filePath,
      fileName: input.fileName || input.filePath.split(/[/\\]/).pop() || '',
      title: input.title || '',
      evidenceType: input.evidenceType || '',
      sectionOrPage: input.sectionOrPage || '',
      notes: input.notes || '',
    }
    set({
      project: touchProject({ ...project, evidence: [...project.evidence, created] }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
    return created.id
  },

  deleteEvidence: (id) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return
    set({
      project: touchProject({
        ...project,
        evidence: project.evidence.filter((e) => e.id !== id),
        requirements: project.requirements.map((r) => ({
          ...r,
          evidenceIds: r.evidenceIds.filter((x) => x !== id),
        })),
        verifications: project.verifications.map((v) => ({
          ...v,
          evidenceIds: v.evidenceIds.filter((x) => x !== id),
        })),
        assessments: project.assessments.map((a) => ({
          ...a,
          evidenceIds: a.evidenceIds.filter((x) => x !== id),
        })),
      }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
  },

  upsertVerification: (input, editorName) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return ''
    const ts = nowIso()
    if (input.id) {
      const updated: VerificationRecord = {
        ...project.verifications.find((v) => v.id === input.id)!,
        ...input,
        id: input.id,
        notes: ensureLinkSafety(input.notes || ''),
        assessmentNarrative: ensureLinkSafety(input.assessmentNarrative || ''),
        modifiedAt: ts,
        editorName: editorName || project.metadata.editorNameDefault || '',
      }
      set({
        project: touchProject({
          ...project,
          verifications: project.verifications.map((v) => (v.id === input.id ? updated : v)),
        }),
        hasUnexportedChanges: true,
        lastExportNotice: false,
      })
      schedulePersist(get, set)
      return input.id
    }
    const created: VerificationRecord = {
      id: newId(),
      requirementId: input.requirementId,
      methodId: input.methodId || '',
      testActivityId: input.testActivityId ?? null,
      statusId: input.statusId || '',
      evidenceIds: input.evidenceIds || [],
      notes: ensureLinkSafety(input.notes || ''),
      assessmentResultId: input.assessmentResultId || '',
      assessmentNarrative: ensureLinkSafety(input.assessmentNarrative || ''),
      createdAt: ts,
      modifiedAt: ts,
      editorName: editorName || project.metadata.editorNameDefault || '',
    }
    set({
      project: touchProject({ ...project, verifications: [...project.verifications, created] }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
    return created.id
  },

  deleteVerification: (id) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return
    set({
      project: touchProject({
        ...project,
        verifications: project.verifications.filter((v) => v.id !== id),
      }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
  },

  upsertAssessment: (input) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return ''
    const ts = nowIso()
    let assessments = [...project.assessments]
    if (input.isCurrent) {
      assessments = assessments.map((a) =>
        a.requirementId === input.requirementId ? { ...a, isCurrent: false } : a,
      )
    }
    if (input.id) {
      assessments = assessments.map((a) =>
        a.id === input.id
          ? {
              ...a,
              ...input,
              id: input.id,
              narrative: ensureLinkSafety(input.narrative || ''),
              modifiedAt: ts,
            }
          : a,
      )
      set({
        project: touchProject({ ...project, assessments }),
        hasUnexportedChanges: true,
        lastExportNotice: false,
      })
      schedulePersist(get, set)
      return input.id
    }
    const created: AssessmentRecord = {
      id: newId(),
      requirementId: input.requirementId,
      resultId: input.resultId,
      narrative: ensureLinkSafety(input.narrative || ''),
      evidenceIds: input.evidenceIds || [],
      testActivityId: input.testActivityId ?? null,
      assessorName: input.assessorName || project.metadata.editorNameDefault || '',
      assessmentDate: input.assessmentDate || ts.slice(0, 10),
      isCurrent: input.isCurrent ?? true,
      createdAt: ts,
      modifiedAt: ts,
    }
    if (created.isCurrent) {
      assessments = assessments.map((a) =>
        a.requirementId === created.requirementId ? { ...a, isCurrent: false } : a,
      )
    }
    set({
      project: touchProject({ ...project, assessments: [...assessments, created] }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
    return created.id
  },

  deleteAssessment: (id) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return
    set({
      project: touchProject({
        ...project,
        assessments: project.assessments.filter((a) => a.id !== id),
      }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
  },

  upsertTagCategory: (input) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return ''
    if (input.id) {
      set({
        project: touchProject({
          ...project,
          tagCategories: project.tagCategories.map((c) =>
            c.id === input.id ? { ...c, ...input, id: input.id, name: input.name.trim() } : c,
          ),
        }),
        hasUnexportedChanges: true,
        lastExportNotice: false,
      })
      schedulePersist(get, set)
      return input.id
    }
    const created: TagCategory = {
      id: newId(),
      name: input.name.trim(),
      active: input.active ?? true,
      sortOrder: input.sortOrder ?? project.tagCategories.length + 1,
    }
    set({
      project: touchProject({ ...project, tagCategories: [...project.tagCategories, created] }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
    return created.id
  },

  deleteTagCategory: (id, mode, reassignTo) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return { ok: false, message: 'Edit Mode required.' }
    const tags = project.tags.filter((t) => t.categoryId === id)
    const tagIds = new Set(tags.map((t) => t.id))
    const used = project.requirements.some((r) => r.tagIds.some((tid) => tagIds.has(tid)))
    if (used && mode === 'block') {
      return { ok: false, message: 'Category has tags assigned to requirements. Confirm how to handle them.' }
    }
    let requirements = project.requirements
    let remainingTags = project.tags.filter((t) => t.categoryId !== id)
    if (mode === 'clear') {
      requirements = requirements.map((r) => ({
        ...r,
        tagIds: r.tagIds.filter((tid) => !tagIds.has(tid)),
      }))
    } else if (mode === 'reassign' && reassignTo) {
      remainingTags = [
        ...project.tags.filter((t) => t.categoryId !== id),
        ...tags.map((t) => ({ ...t, categoryId: reassignTo })),
      ]
    }
    set({
      project: touchProject({
        ...project,
        tagCategories: project.tagCategories.filter((c) => c.id !== id),
        tags: remainingTags,
        requirements,
      }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
    return { ok: true }
  },

  upsertTag: (input) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return ''
    if (input.id) {
      set({
        project: touchProject({
          ...project,
          tags: project.tags.map((t) =>
            t.id === input.id ? { ...t, ...input, id: input.id, name: input.name.trim() } : t,
          ),
        }),
        hasUnexportedChanges: true,
        lastExportNotice: false,
      })
      schedulePersist(get, set)
      return input.id
    }
    const created: Tag = {
      id: newId(),
      categoryId: input.categoryId,
      name: input.name.trim(),
      active: input.active ?? true,
      sortOrder: input.sortOrder ?? project.tags.length + 1,
    }
    set({
      project: touchProject({ ...project, tags: [...project.tags, created] }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
    return created.id
  },

  deleteTag: (id, mode) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return { ok: false, message: 'Edit Mode required.' }
    const used = project.requirements.some((r) => r.tagIds.includes(id))
    if (used && mode === 'block') {
      return { ok: false, message: 'Tag is assigned to requirements. Confirm clearing assignments.' }
    }
    set({
      project: touchProject({
        ...project,
        tags: project.tags.filter((t) => t.id !== id),
        requirements: project.requirements.map((r) => ({
          ...r,
          tagIds: r.tagIds.filter((tid) => tid !== id),
        })),
      }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
    return { ok: true }
  },

  upsertLookup: (key, input) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return { ok: false }
    const list = project.lookups[key]
    const dup = list.find(
      (item) => item.id !== input.id && item.value.trim().toLowerCase() === input.value.trim().toLowerCase(),
    )
    if (input.id) {
      const usedCount = countLookupUsage(project, key, input.id)
      set({
        project: touchProject({
          ...project,
          lookups: {
            ...project.lookups,
            [key]: list.map((item) =>
              item.id === input.id ? { ...item, ...input, id: input.id, value: input.value.trim() } : item,
            ),
          },
        }),
        hasUnexportedChanges: true,
        lastExportNotice: false,
      })
      schedulePersist(get, set)
      return {
        ok: true,
        id: input.id,
        warning:
          dup
            ? 'An apparent duplicate value already exists.'
            : usedCount > 0
              ? `This value is used by ${usedCount} record(s).`
              : undefined,
      }
    }
    const created: LookupValue = {
      id: newId(),
      value: input.value.trim(),
      active: input.active ?? true,
      sortOrder: input.sortOrder ?? list.length + 1,
      system: false,
    }
    set({
      project: touchProject({
        ...project,
        lookups: { ...project.lookups, [key]: [...list, created] },
      }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
    return { ok: true, id: created.id, warning: dup ? 'An apparent duplicate value already exists.' : undefined }
  },

  deleteLookup: (key, id, mode, reassignTo) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return { ok: false, message: 'Edit Mode required.' }
    const used = countLookupUsage(project, key, id)
    if (used > 0 && mode === 'block') {
      return { ok: false, message: `Value is used by ${used} record(s). Reassign or cancel.` }
    }
    let next = structuredClone(project)
    if (used > 0 && mode === 'reassign' && reassignTo) {
      next = reassignLookup(next, key, id, reassignTo)
    }
    next.lookups[key] = next.lookups[key].filter((item) => item.id !== id)
    set({ project: touchProject(next), hasUnexportedChanges: true, lastExportNotice: false })
    schedulePersist(get, set)
    return { ok: true }
  },

  upsertSavedView: (input) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return ''
    const ts = nowIso()
    if (input.id) {
      set({
        project: touchProject({
          ...project,
          savedViews: project.savedViews.map((v) =>
            v.id === input.id
              ? {
                  ...v,
                  ...input,
                  id: input.id,
                  name: input.name.trim(),
                  modifiedAt: ts,
                }
              : v,
          ),
        }),
        hasUnexportedChanges: true,
        lastExportNotice: false,
      })
      schedulePersist(get, set)
      return input.id
    }
    const created: SavedView = {
      id: newId(),
      name: input.name.trim(),
      searchQuery: input.searchQuery ?? '',
      filters: input.filters ?? emptyFilters(),
      tagLogic: input.tagLogic ?? 'any',
      sort: input.sort ?? [{ field: 'sourceId', direction: 'asc' }],
      visibleColumns: input.visibleColumns ?? [...DEFAULT_COLUMNS],
      createdAt: ts,
      modifiedAt: ts,
    }
    set({
      project: touchProject({ ...project, savedViews: [...project.savedViews, created] }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
    return created.id
  },

  deleteSavedView: (id) => {
    const project = get().project
    if (!project || get().mode !== 'edit') return
    set({
      project: touchProject({
        ...project,
        savedViews: project.savedViews.filter((v) => v.id !== id),
      }),
      hasUnexportedChanges: true,
      lastExportNotice: false,
    })
    schedulePersist(get, set)
  },
}))

function countLookupUsage(project: ProjectData, key: keyof Lookups, id: string): number {
  switch (key) {
    case 'statuses':
      return project.requirements.filter((r) => r.statusId === id).length
    case 'types':
      return project.requirements.filter((r) => r.typeId === id).length
    case 'classifications':
      return project.requirements.filter((r) => r.classificationId === id).length
    case 'priorities':
      return project.requirements.filter((r) => r.priorityId === id).length
    case 'verificationMethods':
      return project.verifications.filter((v) => v.methodId === id).length
    case 'verificationStatuses':
      return project.verifications.filter((v) => v.statusId === id).length
    case 'assessmentResults':
      return (
        project.assessments.filter((a) => a.resultId === id).length +
        project.verifications.filter((v) => v.assessmentResultId === id).length
      )
    case 'testActivityTypes':
      return project.testActivities.filter((t) => t.typeId === id).length
    case 'testPhases':
      return project.testActivities.filter((t) => t.phaseId === id).length
    case 'testActivityStatuses':
      return project.testActivities.filter((t) => t.statusId === id).length
    case 'evidenceTypes':
      return project.evidence.filter((e) => e.evidenceType === id).length
    default:
      return 0
  }
}

function reassignLookup(project: ProjectData, key: keyof Lookups, from: string, to: string): ProjectData {
  const next = structuredClone(project)
  switch (key) {
    case 'statuses':
      next.requirements = next.requirements.map((r) => (r.statusId === from ? { ...r, statusId: to } : r))
      break
    case 'types':
      next.requirements = next.requirements.map((r) => (r.typeId === from ? { ...r, typeId: to } : r))
      break
    case 'classifications':
      next.requirements = next.requirements.map((r) =>
        r.classificationId === from ? { ...r, classificationId: to } : r,
      )
      break
    case 'priorities':
      next.requirements = next.requirements.map((r) => (r.priorityId === from ? { ...r, priorityId: to } : r))
      break
    case 'verificationMethods':
      next.verifications = next.verifications.map((v) => (v.methodId === from ? { ...v, methodId: to } : v))
      break
    case 'verificationStatuses':
      next.verifications = next.verifications.map((v) => (v.statusId === from ? { ...v, statusId: to } : v))
      break
    case 'assessmentResults':
      next.assessments = next.assessments.map((a) => (a.resultId === from ? { ...a, resultId: to } : a))
      next.verifications = next.verifications.map((v) =>
        v.assessmentResultId === from ? { ...v, assessmentResultId: to } : v,
      )
      break
    case 'testActivityTypes':
      next.testActivities = next.testActivities.map((t) => (t.typeId === from ? { ...t, typeId: to } : t))
      break
    case 'testPhases':
      next.testActivities = next.testActivities.map((t) => (t.phaseId === from ? { ...t, phaseId: to } : t))
      break
    case 'testActivityStatuses':
      next.testActivities = next.testActivities.map((t) => (t.statusId === from ? { ...t, statusId: to } : t))
      break
    case 'evidenceTypes':
      next.evidence = next.evidence.map((e) => (e.evidenceType === from ? { ...e, evidenceType: to } : e))
      break
  }
  return next
}
