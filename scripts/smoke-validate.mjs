import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// Lightweight Node smoke check for the .otreq shape used by the app.
// Mirrors critical createEmptyProject / sample fields without importing the TS modules.

const formatId = 'otreq-project'
const schemaVersion = 2

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const sample = {
  formatId,
  schemaVersion,
  applicationVersion: '1.0.0',
  metadata: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Smoke Project',
    description: '',
    classificationBanner: '',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    exportSequence: 1,
    lastExportedAt: new Date().toISOString(),
    lastExportEditor: 'Smoke',
    schemaVersion,
    applicationVersion: '1.0.0',
    editorNameDefault: 'Smoke',
  },
  lookups: {
    statuses: [{ id: 's1', value: 'Active', active: true, sortOrder: 1 }],
    types: [{ id: 't1', value: 'Functional', active: true, sortOrder: 1 }],
    classifications: [{ id: 'c1', value: 'UNCLASSIFIED', active: true, sortOrder: 1 }],
    priorities: [{ id: 'p1', value: 'High', active: true, sortOrder: 1 }],
    verificationMethods: [{ id: 'm1', value: 'Test', active: true, sortOrder: 1 }],
    verificationStatuses: [{ id: 'vs1', value: 'Planned', active: true, sortOrder: 1 }],
    assessmentResults: [{ id: 'a1', value: 'Not Yet Assessed', active: true, sortOrder: 1 }],
    testActivityTypes: [{ id: 'tt1', value: 'Flight Test', active: true, sortOrder: 1 }],
    testPhases: [{ id: 'tp1', value: 'OT', active: true, sortOrder: 1 }],
    testActivityStatuses: [{ id: 'ts1', value: 'Planned', active: true, sortOrder: 1 }],
    evidenceTypes: [{ id: 'e1', value: 'Other', active: true, sortOrder: 1 }],
  },
  tagCategories: [],
  tags: [],
  requirements: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      sourceId: 'SRD-001',
      sourceDocumentId: '33333333-3333-4333-8333-333333333333',
      shortTitle: 'Smoke req',
      requirementText: '<p>Shall do the thing.</p>',
      statusId: 's1',
      classificationId: 'c1',
      description: '',
      analystNotes: '',
      rationale: '',
      typeId: 't1',
      priorityId: 'p1',
      tagIds: [],
      isDerived: false,
      verificationNotes: '',
      evidenceIds: [],
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      editorName: 'Smoke',
      changeSummary: 'created',
    },
  ],
  watchItems: [
    {
      id: '55555555-5555-4555-8555-555555555555',
      title: 'Smoke watch item',
      description: '<p>Confirm the offline round trip.</p>',
      status: 'Open',
      observations: [
        {
          id: '66666666-6666-4666-8666-666666666666',
          text: '<p>Initial smoke observation.</p>',
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          editorName: 'Smoke',
        },
      ],
      requirementIds: ['22222222-2222-4222-8222-222222222222'],
      sourceIds: ['33333333-3333-4333-8333-333333333333'],
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      editorName: 'Smoke',
    },
  ],
  relationships: [],
  sources: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      identifier: 'SRD',
      title: 'Smoke System Requirements Document',
      sourceType: 'Requirements document',
      version: '1',
      publisher: '',
      publicationDate: '',
      url: '',
      filePath: '',
      description: '',
      notes: '',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      editorName: 'Smoke',
    },
  ],
  requirementSourceLinks: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      requirementId: '22222222-2222-4222-8222-222222222222',
      sourceId: '33333333-3333-4333-8333-333333333333',
      type: 'Cites',
      locator: '1.1',
      rationale: '',
      notes: '',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      editorName: 'Smoke',
    },
  ],
  testActivities: [],
  requirementActivityLinks: [],
  evidence: [],
  verifications: [],
  assessments: [],
  savedViews: [],
}

assert(sample.formatId === formatId, 'format id')
assert(sample.schemaVersion === schemaVersion, 'schema')
assert(sample.requirements[0].sourceId, 'source id required')
assert(sample.requirements[0].requirementText, 'text required')
assert(sample.sources[0].title, 'source title required')
assert(sample.requirementSourceLinks[0].sourceId === sample.sources[0].id, 'source link')
assert(sample.watchItems[0].observations.length > 0, 'watch item observations')

const out = new URL('../dist/smoke-sample.otreq', import.meta.url)
writeFileSync(out, JSON.stringify(sample, null, 2))
const roundTrip = JSON.parse(readFileSync(out, 'utf8'))
assert(roundTrip.metadata.name === 'Smoke Project', 'round trip')

for (const filename of [
  'Requirements_SIMPLE_v001_2026-07-26.otreq',
  'Requirements_STRESS_v001_2026-07-26.otreq',
]) {
  const example = JSON.parse(
    readFileSync(new URL(`../examples/${filename}`, import.meta.url), 'utf8'),
  )
  assert(example.schemaVersion === schemaVersion, `${filename} current schema`)
  assert(Array.isArray(example.sources), `${filename} sources`)
  assert(Array.isArray(example.requirementSourceLinks), `${filename} source links`)
  assert(Array.isArray(example.watchItems), `${filename} watch items`)
  assert(
    example.watchItems.every(
      (watchItem) =>
        watchItem.title &&
        watchItem.observations.length > 0 &&
        Array.isArray(watchItem.requirementIds) &&
        Array.isArray(watchItem.sourceIds),
    ),
    `${filename} valid watch items`,
  )
  assert(
    example.requirements.every(
      (requirement) =>
        typeof requirement.sourceDocumentId === 'string' &&
        !Object.hasOwn(requirement, 'sourceDocument') &&
        !Object.hasOwn(requirement, 'sourceDocumentVersion') &&
        !Object.hasOwn(requirement, 'sourceSection'),
    ),
    `${filename} has sourceDocumentId and no legacy provenance fields`,
  )
}

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')
assert(html.includes('<div id="root"></div>'), 'root mount present')
assert(!html.includes('https://cdn.'), 'no CDN references')
assert(!html.includes('fonts.googleapis'), 'no remote fonts')
assert(html.includes('<script'), 'script inlined or present')

console.log('Smoke validation passed.')
void createRequire
