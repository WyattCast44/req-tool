/**
 * Generates a large deterministic .otreq project for UX stress testing (~900 requirements).
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const REQ_COUNT = 900
const ACTIVITY_COUNT = 48
const EVIDENCE_COUNT = 120

const id = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function seeded(n) {
  // deterministic 0..1 from integer
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

function pick(arr, n) {
  return arr[Math.floor(seeded(n) * arr.length) % arr.length]
}

function pickSome(arr, n, count) {
  const out = []
  for (let i = 0; i < count; i += 1) {
    const item = pick(arr, n + i * 17)
    if (!out.includes(item)) out.push(item)
  }
  return out
}

function isoDaysAgo(base, days, n) {
  const d = new Date(base)
  d.setUTCDate(d.getUTCDate() - days - Math.floor(seeded(n) * 3))
  return d.toISOString()
}

const baseTs = '2026-07-26T18:00:00.000Z'

const statusNames = ['Draft', 'Active', 'Needs Review', 'Superseded', 'Retired', 'Rejected', 'Out of Scope']
const typeNames = ['Functional', 'Performance', 'Interface', 'Safety', 'Security', 'Operational', 'Other']
const classNames = ['UNCLASSIFIED', 'CUI', 'CONFIDENTIAL', 'SECRET', 'TOP SECRET']
const priorityNames = ['Critical', 'High', 'Medium', 'Low']
const methodNames = ['Test', 'Analysis', 'Inspection', 'Demonstration']
const vStatusNames = ['Planned', 'In Progress', 'Complete', 'Blocked', 'Not Applicable']
const assessNames = ['Not Yet Assessed', 'Met', 'Partially Met', 'Not Met', 'Inconclusive']
const actTypeNames = ['Flight Test', 'Ground Test', 'Lab Test', 'Simulation', 'Tabletop', 'Other']
const phaseNames = ['DT', 'OT', 'IOT&E', 'FOT&E', 'Regression']
const actStatusNames = ['Planned', 'Scheduled', 'In Progress', 'Complete', 'Cancelled']
const evidenceTypeNames = ['Test Report', 'Data Package', 'Photograph', 'Video', 'Analysis Memo', 'Other']

const toLookup = (names, start) =>
  names.map((value, index) => ({
    id: id(start + index),
    value,
    active: true,
    sortOrder: index + 1,
    system: true,
  }))

const statuses = toLookup(statusNames, 101)
const types = toLookup(typeNames, 201)
const classifications = toLookup(classNames, 301)
const priorities = toLookup(priorityNames, 401)
const methods = toLookup(methodNames, 501)
const vStatuses = toLookup(vStatusNames, 601)
const assessmentResults = toLookup(assessNames, 701)
const actTypes = toLookup(actTypeNames, 801)
const phases = toLookup(phaseNames, 901)
const actStatuses = toLookup(actStatusNames, 1001)
const evidenceTypes = toLookup(evidenceTypeNames, 1101)

const byValue = (list) => Object.fromEntries(list.map((x) => [x.value, x.id]))
const statusId = byValue(statuses)
const typeId = byValue(types)
const classId = byValue(classifications)
const priorityId = byValue(priorities)
const methodId = byValue(methods)
const vStatusId = byValue(vStatuses)
const assessId = byValue(assessmentResults)
const actTypeId = byValue(actTypes)
const phaseId = byValue(phases)
const actStatusId = byValue(actStatuses)
const evidenceTypeId = byValue(evidenceTypes)

const categories = [
  { id: id(1201), name: 'System or Subsystem', active: true, sortOrder: 1 },
  { id: id(1202), name: 'Mission Area or Capability', active: true, sortOrder: 2 },
  { id: id(1203), name: 'Test Phase or Scenario', active: true, sortOrder: 3 },
  { id: id(1204), name: 'Risk or Priority', active: true, sortOrder: 4 },
]

const tagDefs = [
  ['Avionics', 0],
  ['Comms', 0],
  ['Sensors', 0],
  ['Propulsion', 0],
  ['Ground Station', 0],
  ['Surveillance', 1],
  ['Survivability', 1],
  ['Mission Planning', 1],
  ['Strike', 1],
  ['Logistics', 1],
  ['OT-1', 2],
  ['OT-2', 2],
  ['Night', 2],
  ['Contested', 2],
  ['Shipboard', 2],
  ['Critical Risk', 3],
  ['High Risk', 3],
  ['Medium Risk', 3],
  ['Watch Item', 3],
]

const tags = tagDefs.map(([name, catIndex], i) => ({
  id: id(1301 + i),
  categoryId: categories[catIndex].id,
  name,
  active: true,
  sortOrder: i + 1,
}))

const editors = ['A. Rivera', 'J. Chen', 'M. Okonkwo', 'S. Patel', 'T. Nguyen', 'R. Alvarez']
const subsystems = ['Avionics', 'Comms', 'Sensors', 'Mission Systems', 'C2', 'Survivability']
const verbs = ['detect', 'report', 'maintain', 'inhibit', 'authenticate', 'correlate', 'display', 'record', 'transmit', 'validate']
const nouns = ['contacts', 'tracks', 'alerts', 'latency', 'integrity', 'availability', 'handoff', 'cueing', 'telemetry', 'plans']

const activities = Array.from({ length: ACTIVITY_COUNT }, (_, i) => {
  const n = 3000 + i
  const phase = pick(phaseNames, n)
  const type = pick(actTypeNames, n + 1)
  const status = pick(actStatusNames, n + 2)
  const startMonth = 7 + (i % 5)
  const day = 1 + (i % 25)
  return {
    id: id(n),
    title: `${phase}-${String(i + 1).padStart(2, '0')} ${type} Profile`,
    typeId: actTypeId[type],
    phaseId: phaseId[phase],
    plannedStart: `2026-${String(startMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    plannedEnd: `2026-${String(startMonth).padStart(2, '0')}-${String(Math.min(day + 7, 28)).padStart(2, '0')}`,
    actualStart: status === 'In Progress' || status === 'Complete' ? `2026-${String(startMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '',
    actualEnd: status === 'Complete' ? `2026-${String(startMonth).padStart(2, '0')}-${String(Math.min(day + 5, 28)).padStart(2, '0')}` : '',
    owner: pick(editors, n + 3),
    statusId: actStatusId[status],
    objectives: `<p>Execute ${type.toLowerCase()} objectives for ${phase} event ${i + 1}.</p>`,
    dataSources: '<p>Telemetry, operator logs, instrumentation packages.</p>',
    notes: i % 7 === 0 ? '<p>Includes night and contested variants.</p>' : '',
    createdAt: isoDaysAgo(baseTs, 40 - (i % 30), n),
    modifiedAt: isoDaysAgo(baseTs, 10 - (i % 8), n + 1),
    editorName: pick(editors, n + 4),
  }
})

const evidence = Array.from({ length: EVIDENCE_COUNT }, (_, i) => {
  const n = 4000 + i
  const type = pick(evidenceTypeNames, n)
  const fileName = `EVD_${String(i + 1).padStart(4, '0')}_${type.replace(/\s+/g, '_')}.pdf`
  return {
    id: id(n),
    filePath: `\\\\fileshare\\OT\\EaglesNest\\Stress\\Evidence\\${fileName}`,
    fileName,
    title: `${type} ${i + 1}`,
    evidenceType: evidenceTypeId[type],
    sectionOrPage: `pp. ${1 + (i % 20)}-${3 + (i % 20)}`,
    notes: i % 11 === 0 ? 'Placeholder path for stress import.' : '',
  }
})

const weightedStatus = () => {
  // Bias toward Active for realistic dashboards
  const roll = seeded
  return (n) => {
    const r = roll(n)
    if (r < 0.55) return 'Active'
    if (r < 0.68) return 'Needs Review'
    if (r < 0.78) return 'Draft'
    if (r < 0.86) return 'Superseded'
    if (r < 0.92) return 'Retired'
    if (r < 0.96) return 'Rejected'
    return 'Out of Scope'
  }
}
const statusFor = weightedStatus()

const requirements = []
const relationships = []
const links = []
const verifications = []
const assessments = []

let relSeq = 5000
let linkSeq = 6000
let verSeq = 7000
let assessSeq = 8000

for (let i = 0; i < REQ_COUNT; i += 1) {
  const n = 2000 + i
  const sourceNum = i + 1
  const status = statusFor(n)
  const type = pick(typeNames, n + 2)
  const classification = seeded(n + 3) < 0.75 ? 'UNCLASSIFIED' : pick(['CUI', 'CONFIDENTIAL', 'SECRET'], n + 4)
  const priority = pick(priorityNames, n + 5)
  const subsystem = pick(subsystems, n + 6)
  const verb = pick(verbs, n + 7)
  const noun = pick(nouns, n + 8)
  const isDerived = seeded(n + 9) < 0.22
  const editor = pick(editors, n + 10)
  const createdAt = isoDaysAgo(baseTs, 90 - (i % 80), n)
  const modifiedAt = isoDaysAgo(baseTs, 25 - (i % 20), n + 1)
  const reqTags = pickSome(tags, n + 11, 1 + Math.floor(seeded(n + 12) * 3)).map((t) => t.id)
  // intentional gaps: ~8% no tags
  const tagIds = seeded(n + 13) < 0.08 ? [] : reqTags
  const evidenceIds =
    seeded(n + 14) < 0.35 ? [pick(evidence, n + 15).id, ...(seeded(n + 16) < 0.2 ? [pick(evidence, n + 17).id] : [])] : []

  const req = {
    id: id(n),
    sourceId: `SRD-${String(sourceNum).padStart(4, '0')}`,
    shortTitle: `${subsystem}: ${verb} ${noun}`,
    requirementText: `<p>The system <strong>shall</strong> ${verb} ${noun} for ${subsystem.toLowerCase()} operations under OT conditions.</p><p>Threshold and measurement details are defined in SRD section ${3 + (i % 7)}.${1 + (i % 9)}.</p>`,
    statusId: statusId[status],
    classificationId: classId[classification],
    sourceDocument: i % 9 === 0 ? 'ICD' : i % 5 === 0 ? 'TEMP' : 'SRD',
    sourceDocumentVersion: i % 4 === 0 ? '3.0' : '2.1',
    sourceSection: `${3 + (i % 7)}.${1 + (i % 9)}.${1 + (i % 5)}`,
    description: `<p>${subsystem} requirement covering ${noun} behavior.</p>`,
    analystNotes: i % 13 === 0 ? '<ul><li>Confirm instrumentation points.</li></ul>' : '',
    rationale: `<p>Needed to support ${pick(['surveillance', 'survivability', 'mission planning', 'comms'], n + 18)} COI threads.</p>`,
    typeId: typeId[type],
    priorityId: priorityId[priority],
    tagIds,
    isDerived,
    verificationNotes: i % 17 === 0 ? '<p>Coordinate with lab schedule.</p>' : '',
    evidenceIds: [...new Set(evidenceIds)],
    createdAt,
    modifiedAt,
    editorName: editor,
    changeSummary:
      i % 11 === 0 ? 'Updated after SRD revision' : i % 7 === 0 ? 'Linked test activity' : 'Baseline imported record',
  }
  requirements.push(req)

  // activity links for most active/needs-review
  if ((status === 'Active' || status === 'Needs Review') && seeded(n + 20) < 0.82) {
    const activity = pick(activities, n + 21)
    links.push({
      id: id(linkSeq++),
      requirementId: req.id,
      testActivityId: activity.id,
      notes: seeded(n + 22) < 0.25 ? 'Primary observation point.' : '',
    })
    if (seeded(n + 23) < 0.18) {
      const activity2 = pick(activities, n + 24)
      if (activity2.id !== activity.id) {
        links.push({
          id: id(linkSeq++),
          requirementId: req.id,
          testActivityId: activity2.id,
          notes: '',
        })
      }
    }
  }

  // verification for many records
  if (seeded(n + 25) < 0.72) {
    const method = pick(methodNames, n + 26)
    const linked = links.find((l) => l.requirementId === req.id)
    verifications.push({
      id: id(verSeq++),
      requirementId: req.id,
      methodId: methodId[method],
      testActivityId: linked?.testActivityId ?? null,
      statusId: vStatusId[pick(vStatusNames, n + 27)],
      evidenceIds: req.evidenceIds.slice(0, 1),
      notes: '',
      assessmentResultId: assessId[pick(assessNames, n + 28)],
      assessmentNarrative: '',
      createdAt,
      modifiedAt,
      editorName: editor,
    })
  }

  // assessments for a subset
  if (seeded(n + 29) < 0.55) {
    let result
    const r = seeded(n + 30)
    if (r < 0.45) result = 'Not Yet Assessed'
    else if (r < 0.7) result = 'Met'
    else if (r < 0.85) result = 'Partially Met'
    else if (r < 0.95) result = 'Not Met'
    else result = 'Inconclusive'
    const linked = links.find((l) => l.requirementId === req.id)
    assessments.push({
      id: id(assessSeq++),
      requirementId: req.id,
      resultId: assessId[result],
      narrative: `<p>Assessment for ${req.sourceId}: ${result}.</p>`,
      evidenceIds: req.evidenceIds.slice(0, 1),
      testActivityId: linked?.testActivityId ?? null,
      assessorName: editor,
      assessmentDate: modifiedAt.slice(0, 10),
      isCurrent: true,
      createdAt: modifiedAt,
      modifiedAt,
    })
  }
}

// Relationships: chain parents, derived-from, supports, depends, some conflicts/duplicates
for (let i = 0; i < REQ_COUNT; i += 1) {
  const req = requirements[i]
  const n = 9000 + i

  if (i > 0 && seeded(n) < 0.35) {
    const parent = requirements[i - 1 - Math.floor(seeded(n + 1) * Math.min(i, 8))]
    relationships.push({
      id: id(relSeq++),
      sourceRequirementId: parent.id,
      targetRequirementId: req.id,
      type: 'Parent of',
      rationale: `${parent.sourceId} parents ${req.sourceId}.`,
      notes: '',
      createdAt: req.createdAt,
      modifiedAt: req.modifiedAt,
      editorName: req.editorName,
    })
  }

  if (req.isDerived) {
    // most derived get a source; leave ~12% without for gap testing
    if (seeded(n + 2) > 0.12 && i > 0) {
      const source = requirements[Math.max(0, i - 1 - Math.floor(seeded(n + 3) * 12))]
      relationships.push({
        id: id(relSeq++),
        sourceRequirementId: req.id,
        targetRequirementId: source.id,
        type: 'Derived from',
        rationale: `Derived from ${source.sourceId}.`,
        notes: '',
        createdAt: req.createdAt,
        modifiedAt: req.modifiedAt,
        editorName: req.editorName,
      })
    }
  }

  if (seeded(n + 4) < 0.18 && i + 3 < REQ_COUNT) {
    const target = requirements[i + 1 + Math.floor(seeded(n + 5) * 2)]
    relationships.push({
      id: id(relSeq++),
      sourceRequirementId: req.id,
      targetRequirementId: target.id,
      type: 'Supports',
      rationale: `${req.sourceId} supports ${target.sourceId}.`,
      notes: '',
      createdAt: req.createdAt,
      modifiedAt: req.modifiedAt,
      editorName: req.editorName,
    })
  }

  if (seeded(n + 6) < 0.12 && i + 5 < REQ_COUNT) {
    const target = requirements[i + 2 + Math.floor(seeded(n + 7) * 3)]
    relationships.push({
      id: id(relSeq++),
      sourceRequirementId: req.id,
      targetRequirementId: target.id,
      type: 'Depends on',
      rationale: `${req.sourceId} depends on ${target.sourceId}.`,
      notes: '',
      createdAt: req.createdAt,
      modifiedAt: req.modifiedAt,
      editorName: req.editorName,
    })
  }

  if (seeded(n + 8) < 0.03 && i + 1 < REQ_COUNT) {
    relationships.push({
      id: id(relSeq++),
      sourceRequirementId: req.id,
      targetRequirementId: requirements[i + 1].id,
      type: seeded(n + 9) < 0.5 ? 'Conflicts with' : 'Duplicates',
      rationale: 'Stress-test conflict/duplicate relationship.',
      notes: '',
      createdAt: req.createdAt,
      modifiedAt: req.modifiedAt,
      editorName: req.editorName,
    })
  }
}

// A few requirements intentionally have no relationships (~10% already likely)
// Ensure at least some active with no method/activity remain via generation probabilities.

const project = {
  formatId: 'otreq-project',
  schemaVersion: 1,
  applicationVersion: '1.0.0',
  metadata: {
    id: id(1),
    name: 'EaglesNest OT Stress Dataset',
    description:
      'Large synthetic project (~900 requirements) for stress-testing search, filters, matrix pagination, dashboard aggregations, and relationship views.',
    classificationBanner: 'UNCLASSIFIED // DEMO STRESS DATA — NOT OPERATIONAL',
    createdAt: isoDaysAgo(baseTs, 100, 1),
    modifiedAt: baseTs,
    exportSequence: 1,
    lastExportedAt: baseTs,
    lastExportEditor: 'A. Rivera',
    schemaVersion: 1,
    applicationVersion: '1.0.0',
    editorNameDefault: 'A. Rivera',
  },
  lookups: {
    statuses,
    types,
    classifications,
    priorities,
    verificationMethods: methods,
    verificationStatuses: vStatuses,
    assessmentResults,
    testActivityTypes: actTypes,
    testPhases: phases,
    testActivityStatuses: actStatuses,
    evidenceTypes,
  },
  tagCategories: categories,
  tags,
  requirements,
  relationships,
  testActivities: activities,
  requirementActivityLinks: links,
  evidence,
  verifications,
  assessments,
  savedViews: [
    {
      id: id(9001),
      name: 'Active only',
      searchQuery: '',
      filters: {
        statusIds: [statusId.Active],
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
      },
      tagLogic: 'any',
      sort: [{ field: 'sourceId', direction: 'asc' }],
      visibleColumns: ['sourceId', 'shortTitle', 'status', 'priority', 'assessment', 'modifiedAt'],
      createdAt: baseTs,
      modifiedAt: baseTs,
    },
    {
      id: id(9002),
      name: 'Critical / High priority',
      searchQuery: '',
      filters: {
        statusIds: [],
        classificationIds: [],
        typeIds: [],
        priorityIds: [priorityId.Critical, priorityId.High],
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
      },
      tagLogic: 'any',
      sort: [{ field: 'priority', direction: 'asc' }, { field: 'sourceId', direction: 'asc' }],
      visibleColumns: ['sourceId', 'shortTitle', 'status', 'priority', 'classification', 'assessment'],
      createdAt: baseTs,
      modifiedAt: baseTs,
    },
    {
      id: id(9003),
      name: 'Surveillance tagged',
      searchQuery: '',
      filters: {
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
        tagIds: [tags.find((t) => t.name === 'Surveillance').id],
        createdFrom: '',
        createdTo: '',
        modifiedFrom: '',
        modifiedTo: '',
        gapKey: null,
      },
      tagLogic: 'any',
      sort: [{ field: 'sourceId', direction: 'asc' }],
      visibleColumns: ['sourceId', 'shortTitle', 'status', 'tags', 'assessment', 'modifiedAt'],
      createdAt: baseTs,
      modifiedAt: baseTs,
    },
  ],
}

const outDir = join(root, 'examples')
mkdirSync(outDir, { recursive: true })
const filename = 'EaglesNest_Requirements_STRESS_v001_2026-07-26.otreq'
const outPath = join(outDir, filename)
writeFileSync(outPath, JSON.stringify(project))
const bytes = Buffer.byteLength(JSON.stringify(project))
console.log(`Wrote ${outPath}`)
console.log(`Bytes: ${bytes}`)
console.log(`Requirements: ${requirements.length}`)
console.log(`Relationships: ${relationships.length}`)
console.log(`Activities: ${activities.length}`)
console.log(`Links: ${links.length}`)
console.log(`Verifications: ${verifications.length}`)
console.log(`Assessments: ${assessments.length}`)
console.log(`Evidence: ${evidence.length}`)
console.log(`Tags: ${tags.length}`)
