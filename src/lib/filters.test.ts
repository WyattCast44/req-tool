import { describe, expect, it } from 'vitest'
import { emptyFilters } from '../types/project'
import { createTestProject, createTestRequirement } from '../test/projectFactory'
import { lookupByValue } from './defaults'
import { buildDashboardStats, currentAssessment, filterRequirements } from './filters'
import { buildProjectIndexes, matchesGapIndexed } from './projectIndexes'

describe('requirement filtering and derived indexes', () => {
  it('recognizes the source of a Derived from edge as having a source relationship', () => {
    const project = createTestProject()
    const derived = createTestRequirement(project, 'derived', { isDerived: true })
    const parent = createTestRequirement(project, 'parent')
    project.requirements = [derived, parent]
    project.relationships = [
      {
        id: 'rel-1',
        sourceRequirementId: derived.id,
        targetRequirementId: parent.id,
        type: 'Derived from',
        rationale: '',
        notes: '',
        createdAt: derived.createdAt,
        modifiedAt: derived.modifiedAt,
        editorName: 'Test Analyst',
      },
    ]

    const indexes = buildProjectIndexes(project)

    expect(matchesGapIndexed(project, indexes, derived, 'derived-without-source')).toBe(false)
    expect(buildDashboardStats(project).gaps).toContainEqual(
      expect.objectContaining({ key: 'derived-without-source', count: 0 }),
    )
  })

  it('combines tags with linked verification, activity, phase, owner, and assessment filters', () => {
    const project = createTestProject()
    const matching = createTestRequirement(project, 'matching')
    const other = createTestRequirement(project, 'other')
    project.requirements = [matching, other]

    const tag = {
      id: 'tag-1',
      categoryId: project.tagCategories[0].id,
      name: 'Avionics',
      active: true,
      sortOrder: 1,
    }
    matching.tagIds = [tag.id]
    project.tags = [tag]

    const activity = {
      id: 'activity-1',
      title: 'Operational sortie',
      typeId: project.lookups.testActivityTypes[0].id,
      phaseId: lookupByValue(project.lookups.testPhases, 'OT')!.id,
      plannedStart: '',
      plannedEnd: '',
      actualStart: '',
      actualEnd: '',
      owner: 'Flight Test Lead',
      statusId: project.lookups.testActivityStatuses[0].id,
      objectives: '',
      dataSources: '',
      notes: '',
      createdAt: matching.createdAt,
      modifiedAt: matching.modifiedAt,
      editorName: 'Test Analyst',
    }
    project.testActivities = [activity]
    project.requirementActivityLinks = [
      {
        id: 'link-1',
        requirementId: matching.id,
        testActivityId: activity.id,
        notes: '',
      },
    ]

    const methodId = lookupByValue(project.lookups.verificationMethods, 'Test')!.id
    project.verifications = [
      {
        id: 'verification-1',
        requirementId: matching.id,
        methodId,
        testActivityId: activity.id,
        statusId: project.lookups.verificationStatuses[0].id,
        evidenceIds: [],
        notes: '',
        assessmentResultId: '',
        assessmentNarrative: '',
        createdAt: matching.createdAt,
        modifiedAt: matching.modifiedAt,
        editorName: 'Test Analyst',
      },
    ]

    const resultId = lookupByValue(project.lookups.assessmentResults, 'Met')!.id
    project.assessments = [
      {
        id: 'assessment-1',
        requirementId: matching.id,
        resultId,
        narrative: '',
        evidenceIds: [],
        testActivityId: activity.id,
        assessorName: 'Test Analyst',
        assessmentDate: '2026-07-26',
        isCurrent: true,
        createdAt: matching.createdAt,
        modifiedAt: matching.modifiedAt,
      },
    ]

    const matches = filterRequirements(
      project,
      '',
      {
        ...emptyFilters(),
        verificationMethodIds: [methodId],
        assessmentResultIds: [resultId],
        testActivityIds: [activity.id],
        testPhaseIds: [activity.phaseId],
        owners: [activity.owner],
        tagIds: [tag.id],
      },
      'all',
      [{ field: 'sourceId', direction: 'asc' }],
    )

    expect(matches.map((requirement) => requirement.id)).toEqual([matching.id])
  })

  it('prefers the explicitly current assessment and otherwise falls back to the newest', () => {
    const project = createTestProject()
    const requirement = createTestRequirement(project, 'req-1')
    project.requirements = [requirement]
    const olderResult = project.lookups.assessmentResults[1].id
    const newerResult = project.lookups.assessmentResults[2].id
    project.assessments = [
      {
        id: 'older-current',
        requirementId: requirement.id,
        resultId: olderResult,
        narrative: '',
        evidenceIds: [],
        testActivityId: null,
        assessorName: '',
        assessmentDate: '2026-07-25',
        isCurrent: true,
        createdAt: '2026-07-25T00:00:00.000Z',
        modifiedAt: '2026-07-25T00:00:00.000Z',
      },
      {
        id: 'newer',
        requirementId: requirement.id,
        resultId: newerResult,
        narrative: '',
        evidenceIds: [],
        testActivityId: null,
        assessorName: '',
        assessmentDate: '2026-07-26',
        isCurrent: false,
        createdAt: '2026-07-26T00:00:00.000Z',
        modifiedAt: '2026-07-26T00:00:00.000Z',
      },
    ]

    expect(currentAssessment(project, requirement.id)?.id).toBe('older-current')

    project.assessments[0].isCurrent = false

    expect(currentAssessment(project, requirement.id)?.id).toBe('newer')
  })
})
