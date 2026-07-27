import { createEmptyProject, lookupByValue } from '../lib/defaults'
import type { ProjectData, Requirement } from '../types/project'

const TEST_TIMESTAMP = '2026-07-26T12:00:00.000Z'

export function createTestProject(): ProjectData {
  const project = createEmptyProject('Test Project')
  project.metadata.createdAt = TEST_TIMESTAMP
  project.metadata.modifiedAt = TEST_TIMESTAMP
  project.savedViews = []
  return project
}

export function createTestRequirement(
  project: ProjectData,
  id: string,
  overrides: Partial<Requirement> = {},
): Requirement {
  return {
    id,
    sourceId: id.toUpperCase(),
    shortTitle: `Requirement ${id}`,
    requirementText: '<p>The system shall satisfy the requirement.</p>',
    statusId: lookupByValue(project.lookups.statuses, 'Active')!.id,
    classificationId: lookupByValue(project.lookups.classifications, 'UNCLASSIFIED')!.id,
    sourceDocument: 'SRD',
    sourceDocumentVersion: '1.0',
    sourceSection: '1.1',
    description: '',
    analystNotes: '',
    rationale: '',
    typeId: lookupByValue(project.lookups.types, 'Functional')!.id,
    priorityId: lookupByValue(project.lookups.priorities, 'High')!.id,
    tagIds: [],
    isDerived: false,
    verificationNotes: '',
    evidenceIds: [],
    createdAt: TEST_TIMESTAMP,
    modifiedAt: TEST_TIMESTAMP,
    editorName: 'Test Analyst',
    changeSummary: 'Created for test',
    ...overrides,
  }
}
