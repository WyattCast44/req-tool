import { createEmptyProject, lookupByValue } from './defaults'
import { newId, nowIso } from './ids'
import type { ProjectData } from '../types/project'

/** Creates a small demo project for first-run exploration. */
export function createSampleProject(): ProjectData {
  const project = createEmptyProject('EaglesNest OT Requirements')
  const ts = nowIso()
  project.metadata.description =
    'Sample operational test requirements project for offline review and edit workflows.'
  project.metadata.classificationBanner = 'UNCLASSIFIED // DEMO DATA'
  project.metadata.editorNameDefault = 'Demo Analyst'

  const catSys = project.tagCategories[0]
  const catMission = project.tagCategories[1]
  const tags = [
    { id: newId(), categoryId: catSys.id, name: 'Avionics', active: true, sortOrder: 1 },
    { id: newId(), categoryId: catSys.id, name: 'Comms', active: true, sortOrder: 2 },
    { id: newId(), categoryId: catMission.id, name: 'Surveillance', active: true, sortOrder: 1 },
    { id: newId(), categoryId: catMission.id, name: 'Survivability', active: true, sortOrder: 2 },
  ]
  project.tags = tags

  const status = (name: string) => lookupByValue(project.lookups.statuses, name)!.id
  const classification = lookupByValue(project.lookups.classifications, 'UNCLASSIFIED')!.id
  const type = (name: string) => lookupByValue(project.lookups.types, name)!.id
  const priority = (name: string) => lookupByValue(project.lookups.priorities, name)!.id
  const method = (name: string) => lookupByValue(project.lookups.verificationMethods, name)!.id
  const vStatus = lookupByValue(project.lookups.verificationStatuses, 'Planned')!.id
  const assess = (name: string) => lookupByValue(project.lookups.assessmentResults, name)!.id
  const actType = lookupByValue(project.lookups.testActivityTypes, 'Flight Test')!.id
  const phase = lookupByValue(project.lookups.testPhases, 'OT')!.id
  const actStatus = lookupByValue(project.lookups.testActivityStatuses, 'Planned')!.id

  const activityId = newId()
  project.testActivities = [
    {
      id: activityId,
      title: 'OT-1 Mission Profile Sortie',
      typeId: actType,
      phaseId: phase,
      plannedStart: '2026-08-01',
      plannedEnd: '2026-08-15',
      actualStart: '',
      actualEnd: '',
      owner: 'Flight Test Lead',
      statusId: actStatus,
      objectives: '<p>Execute representative surveillance mission profiles.</p>',
      dataSources: '<p>Aircraft telemetry, operator logs.</p>',
      notes: '',
      createdAt: ts,
      modifiedAt: ts,
      editorName: 'Demo Analyst',
    },
  ]

  const r1 = newId()
  const r2 = newId()
  const r3 = newId()
  const evidenceId = newId()

  project.evidence = [
    {
      id: evidenceId,
      filePath: '\\\\fileshare\\OT\\Evidence\\OT1_telemetry_summary.pdf',
      fileName: 'OT1_telemetry_summary.pdf',
      title: 'OT-1 Telemetry Summary',
      evidenceType: lookupByValue(project.lookups.evidenceTypes, 'Data Package')!.id,
      sectionOrPage: 'pp. 1-12',
      notes: 'Placeholder path for demo.',
    },
  ]

  project.requirements = [
    {
      id: r1,
      sourceId: 'SRD-001',
      shortTitle: 'Detect surface contacts',
      requirementText:
        '<p>The system <strong>shall</strong> detect surface contacts within the assigned surveillance area.</p>',
      statusId: status('Active'),
      classificationId: classification,
      sourceDocument: 'SRD',
      sourceDocumentVersion: '1.2',
      sourceSection: '3.2.1',
      description: '<p>Primary detection requirement for OT mission threads.</p>',
      analystNotes: '',
      rationale: '<p>Needed to support surveillance COI.</p>',
      typeId: type('Operational'),
      priorityId: priority('Critical'),
      tagIds: [tags[0].id, tags[2].id],
      isDerived: false,
      verificationNotes: '',
      evidenceIds: [evidenceId],
      createdAt: ts,
      modifiedAt: ts,
      editorName: 'Demo Analyst',
      changeSummary: 'Initial sample requirement',
    },
    {
      id: r2,
      sourceId: 'SRD-002',
      shortTitle: 'Report track quality',
      requirementText:
        '<p>The system shall report track quality metrics to the operator workstation.</p>',
      statusId: status('Active'),
      classificationId: classification,
      sourceDocument: 'SRD',
      sourceDocumentVersion: '1.2',
      sourceSection: '3.2.2',
      description: '',
      analystNotes: '',
      rationale: '',
      typeId: type('Functional'),
      priorityId: priority('High'),
      tagIds: [tags[0].id],
      isDerived: true,
      verificationNotes: '',
      evidenceIds: [],
      createdAt: ts,
      modifiedAt: ts,
      editorName: 'Demo Analyst',
      changeSummary: 'Initial sample requirement',
    },
    {
      id: r3,
      sourceId: 'SRD-010',
      shortTitle: 'Comms latency threshold',
      requirementText:
        '<p>End-to-end communications latency shall not exceed <em>2 seconds</em> under OT conditions.</p>',
      statusId: status('Needs Review'),
      classificationId: classification,
      sourceDocument: 'SRD',
      sourceDocumentVersion: '1.2',
      sourceSection: '3.4.1',
      description: '',
      analystNotes: '<ul><li>Confirm measurement point definitions.</li></ul>',
      rationale: '',
      typeId: type('Performance'),
      priorityId: priority('Medium'),
      tagIds: [tags[1].id],
      isDerived: false,
      verificationNotes: '',
      evidenceIds: [],
      createdAt: ts,
      modifiedAt: ts,
      editorName: 'Demo Analyst',
      changeSummary: 'Initial sample requirement',
    },
  ]

  project.relationships = [
    {
      id: newId(),
      sourceRequirementId: r1,
      targetRequirementId: r2,
      type: 'Parent of',
      rationale: 'Track quality supports detection employment.',
      notes: '',
      createdAt: ts,
      modifiedAt: ts,
      editorName: 'Demo Analyst',
    },
    {
      id: newId(),
      sourceRequirementId: r2,
      targetRequirementId: r1,
      type: 'Derived from',
      rationale: 'Derived reporting requirement.',
      notes: '',
      createdAt: ts,
      modifiedAt: ts,
      editorName: 'Demo Analyst',
    },
  ]

  project.requirementActivityLinks = [
    {
      id: newId(),
      requirementId: r1,
      testActivityId: activityId,
      notes: 'Primary observation during OT-1.',
    },
    {
      id: newId(),
      requirementId: r2,
      testActivityId: activityId,
      notes: '',
    },
  ]

  project.verifications = [
    {
      id: newId(),
      requirementId: r1,
      methodId: method('Test'),
      testActivityId: activityId,
      statusId: vStatus,
      evidenceIds: [evidenceId],
      notes: '',
      assessmentResultId: assess('Not Yet Assessed'),
      assessmentNarrative: '',
      createdAt: ts,
      modifiedAt: ts,
      editorName: 'Demo Analyst',
    },
  ]

  project.assessments = [
    {
      id: newId(),
      requirementId: r1,
      resultId: assess('Not Yet Assessed'),
      narrative: '<p>Awaiting OT-1 execution.</p>',
      evidenceIds: [evidenceId],
      testActivityId: activityId,
      assessorName: 'Demo Analyst',
      assessmentDate: ts.slice(0, 10),
      isCurrent: true,
      createdAt: ts,
      modifiedAt: ts,
    },
  ]

  return project
}
