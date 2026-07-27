import { describe, expect, it } from 'vitest'
import { createTestProject, createTestRequirement } from '../test/projectFactory'
import { lookupByValue } from './defaults'
import { exportFilename, prepareExportProject, requirementsToCsv } from './export'

describe('project exports', () => {
  it('increments export metadata without mutating the working project', () => {
    const project = createTestProject()
    project.metadata.exportSequence = 7
    project.metadata.lastExportedAt = null

    const exported = prepareExportProject(project, 'Export Analyst')

    expect(exported).not.toBe(project)
    expect(exported.metadata.exportSequence).toBe(8)
    expect(exported.metadata.lastExportEditor).toBe('Export Analyst')
    expect(exported.metadata.lastExportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(project.metadata.exportSequence).toBe(7)
    expect(project.metadata.lastExportedAt).toBeNull()
    expect(exportFilename(exported)).toMatch(
      /^Test_Project_Requirements_v008_\d{4}-\d{2}-\d{2}\.otreq$/,
    )
  })

  it('produces escaped, human-readable CSV from linked project data', () => {
    const project = createTestProject()
    const requirement = createTestRequirement(project, 'req-1', {
      shortTitle: 'Detection, tracking',
      requirementText: '<p>The system shall detect &amp; track.</p>',
    })
    const tag = {
      id: 'tag-1',
      categoryId: project.tagCategories[0].id,
      name: 'Mission "Alpha"',
      active: true,
      sortOrder: 1,
    }
    requirement.tagIds = [tag.id]
    project.requirements = [requirement]
    project.tags = [tag]
    project.verifications = [
      {
        id: 'verification-1',
        requirementId: requirement.id,
        methodId: lookupByValue(project.lookups.verificationMethods, 'Test')!.id,
        testActivityId: null,
        statusId: project.lookups.verificationStatuses[0].id,
        evidenceIds: [],
        notes: '',
        assessmentResultId: '',
        assessmentNarrative: '',
        createdAt: requirement.createdAt,
        modifiedAt: requirement.modifiedAt,
        editorName: 'Test Analyst',
      },
    ]

    const csv = requirementsToCsv(project, [requirement])
    const lines = csv.split('\r\n')

    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('Source ID,Short Title,Requirement Text')
    expect(lines[1]).toContain('"Detection, tracking"')
    expect(lines[1]).toContain('The system shall detect & track.')
    expect(lines[1]).toContain('"Mission ""Alpha"""')
    expect(lines[1]).toContain(',Test,')
  })
})
