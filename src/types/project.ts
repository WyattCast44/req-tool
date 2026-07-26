export const APP_VERSION = '1.0.0'
export const SCHEMA_VERSION = 1
export const FILE_FORMAT_ID = 'otreq-project'
export const FILE_EXTENSION = '.otreq'

export const RELATIONSHIP_TYPES = [
  'Parent of',
  'Child of',
  'Derived from',
  'Supports',
  'Depends on',
  'Conflicts with',
  'Duplicates',
] as const

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number]

export const RECIPROCAL_RELATIONSHIP: Partial<Record<RelationshipType, RelationshipType>> = {
  'Parent of': 'Child of',
  'Child of': 'Parent of',
  Supports: 'Supports',
  'Depends on': 'Depends on',
  'Conflicts with': 'Conflicts with',
  Duplicates: 'Duplicates',
}

export type ProjectMode = 'review' | 'edit'

export type ProjectStateLabel =
  | 'Review Mode — no local changes'
  | 'Edit Mode — no unexported changes'
  | 'Local changes saved — export required'
  | 'Project file exported'
  | 'Local recovery data available'

export interface LookupValue {
  id: string
  value: string
  active: boolean
  sortOrder: number
  system?: boolean
}

export interface TagCategory {
  id: string
  name: string
  active: boolean
  sortOrder: number
}

export interface Tag {
  id: string
  categoryId: string
  name: string
  active: boolean
  sortOrder: number
}

export interface EvidenceReference {
  id: string
  filePath: string
  fileName: string
  title: string
  evidenceType: string
  sectionOrPage: string
  notes: string
}

export interface VerificationRecord {
  id: string
  requirementId: string
  methodId: string
  testActivityId: string | null
  statusId: string
  evidenceIds: string[]
  notes: string
  assessmentResultId: string
  assessmentNarrative: string
  createdAt: string
  modifiedAt: string
  editorName: string
}

export interface AssessmentRecord {
  id: string
  requirementId: string
  resultId: string
  narrative: string
  evidenceIds: string[]
  testActivityId: string | null
  assessorName: string
  assessmentDate: string
  isCurrent: boolean
  createdAt: string
  modifiedAt: string
}

export interface RequirementActivityLink {
  id: string
  requirementId: string
  testActivityId: string
  notes: string
}

export interface RequirementRelationship {
  id: string
  sourceRequirementId: string
  targetRequirementId: string
  type: RelationshipType
  rationale: string
  notes: string
  createdAt: string
  modifiedAt: string
  editorName: string
}

export interface Requirement {
  id: string
  sourceId: string
  shortTitle: string
  requirementText: string
  statusId: string
  classificationId: string
  sourceDocument: string
  sourceDocumentVersion: string
  sourceSection: string
  description: string
  analystNotes: string
  rationale: string
  typeId: string
  priorityId: string
  tagIds: string[]
  isDerived: boolean
  verificationNotes: string
  evidenceIds: string[]
  createdAt: string
  modifiedAt: string
  editorName: string
  changeSummary: string
}

export interface TestActivity {
  id: string
  title: string
  typeId: string
  phaseId: string
  plannedStart: string
  plannedEnd: string
  actualStart: string
  actualEnd: string
  owner: string
  statusId: string
  objectives: string
  dataSources: string
  notes: string
  createdAt: string
  modifiedAt: string
  editorName: string
}

export interface SavedView {
  id: string
  name: string
  searchQuery: string
  filters: RequirementFilters
  tagLogic: TagLogic
  sort: SortSpec[]
  visibleColumns: string[]
  createdAt: string
  modifiedAt: string
}

export type TagLogic = 'any' | 'all' | 'exclude'

export interface RequirementFilters {
  statusIds: string[]
  classificationIds: string[]
  typeIds: string[]
  priorityIds: string[]
  verificationMethodIds: string[]
  assessmentResultIds: string[]
  testActivityIds: string[]
  testPhaseIds: string[]
  owners: string[]
  sourceDocuments: string[]
  tagIds: string[]
  createdFrom: string
  createdTo: string
  modifiedFrom: string
  modifiedTo: string
  gapKey?: string | null
}

export interface SortSpec {
  field: string
  direction: 'asc' | 'desc'
}

export interface ProjectMetadata {
  id: string
  name: string
  description: string
  classificationBanner: string
  createdAt: string
  modifiedAt: string
  exportSequence: number
  lastExportedAt: string | null
  lastExportEditor: string
  schemaVersion: number
  applicationVersion: string
  editorNameDefault: string
}

export interface Lookups {
  statuses: LookupValue[]
  types: LookupValue[]
  classifications: LookupValue[]
  priorities: LookupValue[]
  verificationMethods: LookupValue[]
  verificationStatuses: LookupValue[]
  assessmentResults: LookupValue[]
  testActivityTypes: LookupValue[]
  testPhases: LookupValue[]
  testActivityStatuses: LookupValue[]
  evidenceTypes: LookupValue[]
}

export interface ProjectData {
  formatId: typeof FILE_FORMAT_ID
  schemaVersion: number
  applicationVersion: string
  metadata: ProjectMetadata
  lookups: Lookups
  tagCategories: TagCategory[]
  tags: Tag[]
  requirements: Requirement[]
  relationships: RequirementRelationship[]
  testActivities: TestActivity[]
  requirementActivityLinks: RequirementActivityLink[]
  evidence: EvidenceReference[]
  verifications: VerificationRecord[]
  assessments: AssessmentRecord[]
  savedViews: SavedView[]
}

export interface LocalWorkspaceRecord {
  projectId: string
  project: ProjectData
  mode: ProjectMode
  hasUnexportedChanges: boolean
  localSavedAt: string
  sourceFileName: string | null
}

export function emptyFilters(): RequirementFilters {
  return {
    statusIds: [],
    classificationIds: [],
    typeIds: [],
    priorityIds: [],
    verificationMethodIds: [],
    assessmentResultIds: [],
    testActivityIds: [],
    testPhaseIds: [],
    owners: [],
    sourceDocuments: [],
    tagIds: [],
    createdFrom: '',
    createdTo: '',
    modifiedFrom: '',
    modifiedTo: '',
    gapKey: null,
  }
}

export const DEFAULT_COLUMNS = [
  'sourceId',
  'shortTitle',
  'status',
  'classification',
  'priority',
  'assessment',
  'modifiedAt',
] as const

export type ColumnId =
  | 'sourceId'
  | 'shortTitle'
  | 'status'
  | 'classification'
  | 'type'
  | 'priority'
  | 'assessment'
  | 'verification'
  | 'tags'
  | 'sourceDocument'
  | 'modifiedAt'
  | 'editorName'
