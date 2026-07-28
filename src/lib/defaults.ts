import {
  APP_VERSION,
  FILE_FORMAT_ID,
  SCHEMA_VERSION,
  emptyFilters,
  type Lookups,
  type LookupValue,
  type ProjectData,
  type TagCategory,
} from '../types/project'
import { newId, nowIso } from './ids'

function lv(value: string, sortOrder: number, system = true): LookupValue {
  return { id: newId(), value, active: true, sortOrder, system }
}

export function createDefaultLookups(): Lookups {
  return {
    statuses: [
      lv('Draft', 1),
      lv('Active', 2),
      lv('Needs Review', 3),
      lv('Superseded', 4),
      lv('Retired', 5),
      lv('Rejected', 6),
      lv('Out of Scope', 7),
    ],
    types: [
      lv('Functional', 1),
      lv('Performance', 2),
      lv('Interface', 3),
      lv('Safety', 4),
      lv('Security', 5),
      lv('Operational', 6),
      lv('Other', 7),
    ],
    classifications: [
      lv('UNCLASSIFIED', 1),
      lv('CUI', 2),
      lv('CONFIDENTIAL', 3),
      lv('SECRET', 4),
      lv('TOP SECRET', 5),
    ],
    priorities: [lv('Critical', 1), lv('High', 2), lv('Medium', 3), lv('Low', 4)],
    verificationMethods: [
      lv('Test', 1),
      lv('Analysis', 2),
      lv('Inspection', 3),
      lv('Demonstration', 4),
    ],
    verificationStatuses: [
      lv('Planned', 1),
      lv('In Progress', 2),
      lv('Complete', 3),
      lv('Blocked', 4),
      lv('Not Applicable', 5),
    ],
    assessmentResults: [
      lv('Not Yet Assessed', 1),
      lv('Met', 2),
      lv('Partially Met', 3),
      lv('Not Met', 4),
      lv('Inconclusive', 5),
    ],
    testActivityTypes: [
      lv('Flight Test', 1),
      lv('Ground Test', 2),
      lv('Lab Test', 3),
      lv('Simulation', 4),
      lv('Tabletop', 5),
      lv('Other', 6),
    ],
    testPhases: [
      lv('DT', 1),
      lv('OT', 2),
      lv('IOT&E', 3),
      lv('FOT&E', 4),
      lv('Regression', 5),
    ],
    testActivityStatuses: [
      lv('Planned', 1),
      lv('Scheduled', 2),
      lv('In Progress', 3),
      lv('Complete', 4),
      lv('Cancelled', 5),
    ],
    evidenceTypes: [
      lv('Test Report', 1),
      lv('Data Package', 2),
      lv('Photograph', 3),
      lv('Video', 4),
      lv('Analysis Memo', 5),
      lv('Other', 6),
    ],
  }
}

export function createDefaultTagCategories(): TagCategory[] {
  return [
    { id: newId(), name: 'System or Subsystem', active: true, sortOrder: 1 },
    { id: newId(), name: 'Mission Area or Capability', active: true, sortOrder: 2 },
    { id: newId(), name: 'Test Phase or Scenario', active: true, sortOrder: 3 },
    { id: newId(), name: 'Risk or Priority', active: true, sortOrder: 4 },
  ]
}

export function createEmptyProject(name = 'New Operational Test Project'): ProjectData {
  const timestamp = nowIso()
  const lookups = createDefaultLookups()
  return {
    formatId: FILE_FORMAT_ID,
    schemaVersion: SCHEMA_VERSION,
    applicationVersion: APP_VERSION,
    metadata: {
      id: newId(),
      name,
      description: '',
      classificationBanner: '',
      createdAt: timestamp,
      modifiedAt: timestamp,
      exportSequence: 0,
      lastExportedAt: null,
      lastExportEditor: '',
      schemaVersion: SCHEMA_VERSION,
      applicationVersion: APP_VERSION,
      editorNameDefault: '',
    },
    lookups,
    tagCategories: createDefaultTagCategories(),
    tags: [],
    requirements: [],
    watchItems: [],
    relationships: [],
    sources: [],
    requirementSourceLinks: [],
    testActivities: [],
    requirementActivityLinks: [],
    evidence: [],
    verifications: [],
    assessments: [],
    savedViews: [
      {
        id: newId(),
        name: 'Active Requirements',
        searchQuery: '',
        filters: {
          ...emptyFilters(),
          statusIds: [lookups.statuses.find((s) => s.value === 'Active')!.id],
        },
        tagLogic: 'any',
        sort: [{ field: 'sourceId', direction: 'asc' }],
        visibleColumns: [
          'sourceId',
          'shortTitle',
          'status',
          'classification',
          'priority',
          'assessment',
          'modifiedAt',
        ],
        createdAt: timestamp,
        modifiedAt: timestamp,
      },
    ],
  }
}

export function lookupByValue(items: LookupValue[], value: string): LookupValue | undefined {
  return items.find((item) => item.value === value)
}

export function lookupLabel(items: LookupValue[], id: string | null | undefined): string {
  if (!id) return '—'
  return items.find((item) => item.id === id)?.value ?? '—'
}
