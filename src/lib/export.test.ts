import { describe, expect, it } from 'vitest'
import { createTestProject, createTestRequirement } from '../test/projectFactory'
import { lookupByValue } from './defaults'
import { exportFilename, prepareExportProject, requirementsToCsv, watchItemsToCsv } from './export'

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
    project.watchItems = [
      {
        id: 'watch-1',
        title: 'Confirm readiness evidence',
        description: '',
        status: 'Open',
        observations: [
          {
            id: 'observation-1',
            text: '<p>Evidence is pending.</p>',
            createdAt: requirement.createdAt,
            modifiedAt: requirement.modifiedAt,
            editorName: 'Test Analyst',
          },
        ],
        requirementIds: [requirement.id],
        sourceIds: [],
        createdAt: requirement.createdAt,
        modifiedAt: requirement.modifiedAt,
        editorName: 'Test Analyst',
      },
    ]
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
    expect(lines[0]).toContain('Source ID,Source Document,Short Title,Requirement Text')
    expect(lines[0]).toContain('Linked Watch Items')
    expect(lines[1]).toContain('"Detection, tracking"')
    expect(lines[1]).toContain('The system shall detect & track.')
    expect(lines[1]).toContain('"Mission ""Alpha"""')
    expect(lines[1]).toContain(',Test,')
    expect(lines[1]).toContain('Confirm readiness evidence')

    const watchCsv = watchItemsToCsv(project)
    expect(watchCsv).toContain('Title,Status,Description,Observations,Requirements,Sources')
    expect(watchCsv).toContain('Confirm readiness evidence,Open')
    expect(watchCsv).toContain('REQ-1')
    expect(watchCsv).toContain('Evidence is pending.')
  })
})
