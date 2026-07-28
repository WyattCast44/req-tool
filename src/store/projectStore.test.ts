import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SCHEMA_VERSION } from '../types/project'
import { createTestProject, createTestRequirement } from '../test/projectFactory'

const idbMocks = vi.hoisted(() => ({
  clearActivePointer: vi.fn(),
  deleteWorkspace: vi.fn(),
  getActiveWorkspace: vi.fn(),
  saveWorkspace: vi.fn(),
}))

vi.mock('../lib/idb', () => idbMocks)
vi.mock('../lib/sanitize', () => ({
  ensureLinkSafety: (html: string) => html,
}))

import { useProjectStore } from './projectStore'

describe('project workspace hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProjectStore.setState({
      project: null,
      mode: 'review',
      hasUnexportedChanges: false,
      localSavedAt: null,
      sourceFileName: null,
      recoveryAvailable: false,
      hydrated: false,
      loadIssues: [],
    })
  })

  it('rejects an incompatible cached workspace without deleting it', async () => {
    const project = createTestProject()
    project.schemaVersion = SCHEMA_VERSION - 1
    project.metadata.schemaVersion = SCHEMA_VERSION - 1
    idbMocks.getActiveWorkspace.mockResolvedValue({
      projectId: project.metadata.id,
      project,
      mode: 'edit',
      hasUnexportedChanges: true,
      localSavedAt: '2026-07-26T12:00:00.000Z',
      sourceFileName: 'legacy.otreq',
    })

    await useProjectStore.getState().hydrate()

    const state = useProjectStore.getState()
    expect(state.hydrated).toBe(true)
    expect(state.project).toBeNull()
    expect(state.loadIssues).toContainEqual(
      expect.stringContaining('Unsupported schema version'),
    )
    expect(idbMocks.deleteWorkspace).not.toHaveBeenCalled()
    expect(idbMocks.clearActivePointer).not.toHaveBeenCalled()
  })

  it('rejects a same-version cached workspace missing the current watchItems collection', async () => {
    const project = createTestProject()
    const staleProject = { ...project } as Partial<typeof project>
    delete staleProject.watchItems
    idbMocks.getActiveWorkspace.mockResolvedValue({
      projectId: project.metadata.id,
      project: staleProject,
      mode: 'edit',
      hasUnexportedChanges: true,
      localSavedAt: '2026-07-26T12:00:00.000Z',
      sourceFileName: 'stale.otreq',
    })

    await useProjectStore.getState().hydrate()

    const state = useProjectStore.getState()
    expect(state.hydrated).toBe(true)
    expect(state.project).toBeNull()
    expect(state.loadIssues).toContainEqual(
      expect.stringContaining('missing the current watchItems collection'),
    )
    expect(idbMocks.deleteWorkspace).not.toHaveBeenCalled()
    expect(idbMocks.clearActivePointer).not.toHaveBeenCalled()
  })

  it('rejects a cached workspace with a malformed watch item without stalling hydration', async () => {
    const project = createTestProject()
    idbMocks.getActiveWorkspace.mockResolvedValue({
      projectId: project.metadata.id,
      project: { ...project, watchItems: [null] },
      mode: 'edit',
      hasUnexportedChanges: true,
      localSavedAt: '2026-07-26T12:00:00.000Z',
      sourceFileName: 'malformed.otreq',
    })

    await useProjectStore.getState().hydrate()

    const state = useProjectStore.getState()
    expect(state.hydrated).toBe(true)
    expect(state.project).toBeNull()
    expect(state.loadIssues).toContainEqual(
      expect.stringContaining('Watch item at index 0 must be an object'),
    )
  })

  it('creates and deletes a standalone watch item with multiple observations', () => {
    const project = createTestProject()
    const requirementA = createTestRequirement(project, 'req-1')
    const requirementB = createTestRequirement(project, 'req-2')
    project.requirements = [requirementA, requirementB]
    project.sources = [
      {
        id: 'source-1',
        identifier: 'SRC',
        title: 'Test source',
        sourceType: '',
        version: '',
        publisher: '',
        publicationDate: '',
        url: '',
        filePath: '',
        description: '',
        notes: '',
        createdAt: requirementA.createdAt,
        modifiedAt: requirementA.modifiedAt,
        editorName: 'Test Analyst',
      },
    ]
    useProjectStore.setState({ project, mode: 'edit' })

    const created = useProjectStore.getState().upsertWatchItem(
      {
        title: 'Confirm closure evidence',
        description: '<p>Independent watch topic.</p>',
        status: 'Open',
        observations: [
          { text: '<p>Initial observation.</p>' },
          { text: '<p>Follow-up observation.</p>' },
        ],
        requirementIds: [],
        sourceIds: [],
      },
      'Test Analyst',
    )

    expect(created.ok).toBe(true)
    const watchItem = useProjectStore.getState().project!.watchItems[0]
    expect(watchItem).toMatchObject({
      title: 'Confirm closure evidence',
      status: 'Open',
      requirementIds: [],
      sourceIds: [],
    })
    expect(watchItem.observations).toHaveLength(2)
    expect(watchItem.observations[0].id).toBeTruthy()

    const linked = useProjectStore.getState().upsertWatchItem(
      {
        ...watchItem,
        requirementIds: [requirementA.id, requirementB.id],
        sourceIds: ['source-1'],
      },
      'Test Analyst',
    )
    expect(linked.ok).toBe(true)
    expect(useProjectStore.getState().project!.watchItems[0]).toMatchObject({
      requirementIds: [requirementA.id, requirementB.id],
      sourceIds: ['source-1'],
    })

    useProjectStore.getState().deleteWatchItem(watchItem.id)
    expect(useProjectStore.getState().project!.watchItems).toEqual([])
  })

  it('updates linked watch item audit metadata when deleting a requirement', () => {
    const project = createTestProject()
    const requirement = createTestRequirement(project, 'req-1')
    project.requirements = [requirement]
    project.watchItems = [
      {
        id: 'watch-linked',
        title: 'Linked watch item',
        description: '',
        status: 'Open',
        observations: [
          {
            id: 'observation-1',
            text: '<p>Initial observation.</p>',
            createdAt: requirement.createdAt,
            modifiedAt: requirement.modifiedAt,
            editorName: 'Original Analyst',
          },
        ],
        requirementIds: [requirement.id],
        sourceIds: [],
        createdAt: requirement.createdAt,
        modifiedAt: requirement.modifiedAt,
        editorName: 'Original Analyst',
      },
      {
        id: 'watch-unlinked',
        title: 'Unlinked watch item',
        description: '',
        status: 'Open',
        observations: [
          {
            id: 'observation-2',
            text: '<p>Unchanged observation.</p>',
            createdAt: requirement.createdAt,
            modifiedAt: requirement.modifiedAt,
            editorName: 'Original Analyst',
          },
        ],
        requirementIds: [],
        sourceIds: [],
        createdAt: requirement.createdAt,
        modifiedAt: requirement.modifiedAt,
        editorName: 'Original Analyst',
      },
    ]
    const unlinkedBefore = structuredClone(project.watchItems[1])
    useProjectStore.setState({ project, mode: 'edit' })

    useProjectStore.getState().deleteRequirement(requirement.id, 'Cascade Analyst')

    const updatedProject = useProjectStore.getState().project!
    expect(updatedProject.requirements).toEqual([])
    expect(updatedProject.watchItems[0]).toMatchObject({
      requirementIds: [],
      editorName: 'Cascade Analyst',
    })
    expect(updatedProject.watchItems[0].modifiedAt).not.toBe(requirement.modifiedAt)
    expect(updatedProject.watchItems[1]).toEqual(unlinkedBefore)
  })

  it('updates requirement and watch item audit metadata when deleting a source', () => {
    const project = createTestProject()
    const source = {
      id: 'source-1',
      identifier: 'SRC-1',
      title: 'Test source',
      sourceType: '',
      version: '',
      publisher: '',
      publicationDate: '',
      url: '',
      filePath: '',
      description: '',
      notes: '',
      createdAt: '2026-07-26T12:00:00.000Z',
      modifiedAt: '2026-07-26T12:00:00.000Z',
      editorName: 'Original Analyst',
    }
    const linkedRequirement = createTestRequirement(project, 'req-linked', {
      sourceDocumentId: source.id,
    })
    const unlinkedRequirement = createTestRequirement(project, 'req-unlinked')
    project.sources = [source]
    project.requirements = [linkedRequirement, unlinkedRequirement]
    project.watchItems = [
      {
        id: 'watch-linked',
        title: 'Linked watch item',
        description: '',
        status: 'Open',
        observations: [
          {
            id: 'observation-1',
            text: '<p>Initial observation.</p>',
            createdAt: linkedRequirement.createdAt,
            modifiedAt: linkedRequirement.modifiedAt,
            editorName: 'Original Analyst',
          },
        ],
        requirementIds: [],
        sourceIds: [source.id],
        createdAt: linkedRequirement.createdAt,
        modifiedAt: linkedRequirement.modifiedAt,
        editorName: 'Original Analyst',
      },
    ]
    const unlinkedRequirementBefore = structuredClone(unlinkedRequirement)
    useProjectStore.setState({ project, mode: 'edit' })

    useProjectStore.getState().deleteSource(source.id, 'Cascade Analyst')

    const updatedProject = useProjectStore.getState().project!
    expect(updatedProject.sources).toEqual([])
    expect(updatedProject.requirements[0]).toMatchObject({
      sourceDocumentId: '',
      editorName: 'Cascade Analyst',
      changeSummary: 'Source document cleared after deleting SRC-1.',
    })
    expect(updatedProject.requirements[0].modifiedAt).not.toBe(linkedRequirement.modifiedAt)
    expect(updatedProject.requirements[1]).toEqual(unlinkedRequirementBefore)
    expect(updatedProject.watchItems[0]).toMatchObject({
      sourceIds: [],
      modifiedAt: updatedProject.requirements[0].modifiedAt,
      editorName: 'Cascade Analyst',
    })
  })
})
