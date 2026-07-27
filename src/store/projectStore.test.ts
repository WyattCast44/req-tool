import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SCHEMA_VERSION } from '../types/project'
import { createTestProject } from '../test/projectFactory'

const idbMocks = vi.hoisted(() => ({
  clearActivePointer: vi.fn(),
  deleteWorkspace: vi.fn(),
  getActiveWorkspace: vi.fn(),
  saveWorkspace: vi.fn(),
}))

vi.mock('../lib/idb', () => idbMocks)

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
      expect.stringContaining('unsupported schema version'),
    )
    expect(idbMocks.deleteWorkspace).not.toHaveBeenCalled()
    expect(idbMocks.clearActivePointer).not.toHaveBeenCalled()
  })
})
