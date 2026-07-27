import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '../types/project'
import { createTestProject, createTestRequirement } from '../test/projectFactory'
import { parseAndValidateProject } from './validate'

describe('parseAndValidateProject', () => {
  it('loads a valid project file', () => {
    const project = createTestProject()
    project.requirements = [createTestRequirement(project, 'req-1')]

    const result = parseAndValidateProject(JSON.stringify(project))

    expect(result.ok).toBe(true)
    expect(result.issues).toEqual([])
    expect(result.project?.requirements[0].sourceId).toBe('REQ-1')
  })

  it('migrates an older sparse project shape', () => {
    const project = createTestProject()
    const sparse = structuredClone(project) as unknown as Record<string, unknown>
    sparse.schemaVersion = 0
    delete sparse.savedViews
    delete sparse.assessments
    delete sparse.verifications

    const result = parseAndValidateProject(JSON.stringify(sparse))

    expect(result.ok).toBe(true)
    expect(result.project?.schemaVersion).toBe(SCHEMA_VERSION)
    expect(result.project?.savedViews).toEqual([])
    expect(result.project?.assessments).toEqual([])
    expect(result.project?.verifications).toEqual([])
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        level: 'warning',
        message: `Migrated project from schema v0 to v${SCHEMA_VERSION}.`,
      }),
    )
  })

  it('rejects files from a newer schema version', () => {
    const project = createTestProject()
    project.schemaVersion = SCHEMA_VERSION + 1

    const result = parseAndValidateProject(JSON.stringify(project))

    expect(result.ok).toBe(false)
    expect(result.issues[0].message).toContain('Unsupported future schema version')
  })

  it('rejects requirements missing required domain fields', () => {
    const project = createTestProject()
    project.requirements = [
      createTestRequirement(project, 'req-1', {
        requirementText: '<p>&nbsp;</p>',
      }),
    ]

    const result = parseAndValidateProject(JSON.stringify(project))

    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        level: 'error',
        path: 'requirements.req-1',
      }),
    )
  })

  it('loads dangling references with actionable warnings', () => {
    const project = createTestProject()
    project.requirements = [
      createTestRequirement(project, 'req-1', {
        tagIds: ['missing-tag'],
        evidenceIds: ['missing-evidence'],
      }),
    ]

    const result = parseAndValidateProject(JSON.stringify(project))

    expect(result.ok).toBe(true)
    expect(result.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        'Requirement REQ-1 references missing tag missing-tag.',
        'Requirement REQ-1 references missing evidence missing-evidence.',
      ]),
    )
  })
})
