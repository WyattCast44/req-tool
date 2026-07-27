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

  it('rejects files from an older schema version', () => {
    const project = createTestProject()
    project.schemaVersion = SCHEMA_VERSION - 1

    const result = parseAndValidateProject(JSON.stringify(project))

    expect(result.ok).toBe(false)
    expect(result.issues[0].message).toContain('Unsupported schema version')
  })

  it('rejects files from a newer schema version', () => {
    const project = createTestProject()
    project.schemaVersion = SCHEMA_VERSION + 1

    const result = parseAndValidateProject(JSON.stringify(project))

    expect(result.ok).toBe(false)
    expect(result.issues[0].message).toContain('Unsupported schema version')
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

  it('loads dangling source links with an actionable warning', () => {
    const project = createTestProject()
    const requirement = createTestRequirement(project, 'req-1')
    project.requirements = [requirement]
    project.requirementSourceLinks = [
      {
        id: 'source-link-1',
        requirementId: requirement.id,
        sourceId: 'missing-source',
        type: 'Cites',
        locator: '',
        rationale: '',
        notes: '',
        createdAt: requirement.createdAt,
        modifiedAt: requirement.modifiedAt,
        editorName: 'Test Analyst',
      },
    ]

    const result = parseAndValidateProject(JSON.stringify(project))

    expect(result.ok).toBe(true)
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        level: 'warning',
        message: 'Broken requirement–source link source-link-1.',
      }),
    )
  })
})
