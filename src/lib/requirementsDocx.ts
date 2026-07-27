import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  PageNumber,
  Paragraph,
  TextRun,
} from 'docx'
import type { ProjectData, Requirement, RequirementRelationship } from '../types/project'

export interface RequirementsDocxRequest {
  project: ProjectData
  requirementIds: string[]
  generatedAt: string
}

export type RequirementsDocxWorkerResponse =
  | { type: 'progress'; message: string }
  | { type: 'complete'; buffer: ArrayBuffer }
  | { type: 'error'; message: string }

const FONT = 'Calibri'
const BODY_COLOR = '1F2937'
const HEADING_COLOR = '2E74B5'
const DARK_HEADING_COLOR = '1F4D78'
const MUTED_COLOR = '5B6472'
const BULLET_REFERENCE = 'requirement-report-bullets'

const RECIPROCAL_RELATIONSHIP: Partial<Record<RequirementRelationship['type'], string>> = {
  'Parent of': 'Child of',
  'Child of': 'Parent of',
  Supports: 'Supports',
  'Depends on': 'Depends on',
  'Conflicts with': 'Conflicts with',
  Duplicates: 'Duplicates',
}

function pushMap<T>(map: Map<string, T[]>, key: string, value: T) {
  const values = map.get(key)
  if (values) values.push(value)
  else map.set(key, [value])
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  }
  return value
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match)
    .replace(/&#(\d+);/g, (match, code: string) => {
      const value = Number(code)
      return Number.isInteger(value) && value >= 0 && value <= 0x10ffff
        ? String.fromCodePoint(value)
        : match
    })
    .replace(/&#x([\da-f]+);/gi, (match, code: string) => {
      const value = Number.parseInt(code, 16)
      return Number.isInteger(value) && value >= 0 && value <= 0x10ffff
        ? String.fromCodePoint(value)
        : match
    })
}

export function docxPlainText(value: string | null | undefined): string {
  return decodeHtmlEntities(
    (value ?? '')
      .replace(/<(?:br|\/p|\/div|\/li)\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

function lookupLabel(
  values: ProjectData['lookups']['statuses'],
  id: string | null | undefined,
): string {
  return values.find((value) => value.id === id)?.value || '—'
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

function fieldParagraph(label: string, value: string): Paragraph {
  return new Paragraph({
    style: 'RequirementMetadata',
    children: [
      new TextRun({ text: `${label}: `, bold: true, color: DARK_HEADING_COLOR }),
      new TextRun(value || '—'),
    ],
  })
}

function addTextSection(children: Paragraph[], title: string, value: string | null | undefined) {
  const text = docxPlainText(value)
  if (!text) return
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun(title)],
    }),
    new Paragraph({ children: [new TextRun(text)] }),
  )
}

function addListSection(children: Paragraph[], title: string, values: string[]) {
  const items = values.map(docxPlainText).filter(Boolean)
  if (items.length === 0) return
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun(title)],
    }),
    ...items.map(
      (text) =>
        new Paragraph({
          numbering: { reference: BULLET_REFERENCE, level: 0 },
          children: [new TextRun(text)],
        }),
    ),
  )
}

function requirementHeading(requirement: Requirement): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true,
    children: [
      new TextRun(
        `${requirement.sourceId} — ${requirement.shortTitle || 'Untitled requirement'}`,
      ),
    ],
  })
}

export function createRequirementsDocx({
  project,
  requirementIds,
  generatedAt,
}: RequirementsDocxRequest): Document {
  const requestedIds = new Set(requirementIds)
  const requirements = project.requirements.filter((requirement) => requestedIds.has(requirement.id))
  const requirementById = new Map(project.requirements.map((requirement) => [requirement.id, requirement]))
  const tagById = new Map(project.tags.map((tag) => [tag.id, tag]))
  const sourceById = new Map((project.sources ?? []).map((source) => [source.id, source]))
  const activityById = new Map(project.testActivities.map((activity) => [activity.id, activity]))
  const evidenceById = new Map(project.evidence.map((evidence) => [evidence.id, evidence]))

  const sourceLinksByRequirement = new Map<string, ProjectData['requirementSourceLinks']>()
  for (const link of project.requirementSourceLinks ?? []) {
    pushMap(sourceLinksByRequirement, link.requirementId, link)
  }

  const verificationsByRequirement = new Map<string, ProjectData['verifications']>()
  for (const verification of project.verifications) {
    pushMap(verificationsByRequirement, verification.requirementId, verification)
  }

  const activityLinksByRequirement = new Map<string, ProjectData['requirementActivityLinks']>()
  for (const link of project.requirementActivityLinks) {
    pushMap(activityLinksByRequirement, link.requirementId, link)
  }

  const assessmentsByRequirement = new Map<string, ProjectData['assessments']>()
  for (const assessment of project.assessments) {
    pushMap(assessmentsByRequirement, assessment.requirementId, assessment)
  }

  const relationshipsByRequirement = new Map<string, ProjectData['relationships']>()
  for (const relationship of project.relationships) {
    pushMap(relationshipsByRequirement, relationship.sourceRequirementId, relationship)
    if (relationship.targetRequirementId !== relationship.sourceRequirementId) {
      pushMap(relationshipsByRequirement, relationship.targetRequirementId, relationship)
    }
  }

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 720, after: 120 },
      children: [
        new TextRun({
          text: project.metadata.name,
          bold: true,
          color: DARK_HEADING_COLOR,
          font: FONT,
          size: 44,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
      children: [
        new TextRun({
          text: 'Operational Test Requirements Report',
          color: MUTED_COLOR,
          font: FONT,
          size: 28,
        }),
      ],
    }),
  ]

  const projectDescription = docxPlainText(project.metadata.description)
  if (projectDescription) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [new TextRun({ text: projectDescription, italics: true })],
      }),
    )
  }

  children.push(
    fieldParagraph('Generated', formatTimestamp(generatedAt)),
    fieldParagraph('Requirements included', String(requirements.length)),
  )

  if (project.metadata.classificationBanner.trim()) {
    children.push(
      fieldParagraph('Classification', project.metadata.classificationBanner.trim()),
    )
  }

  if (requirements.length === 0) {
    children.push(
      new Paragraph({
        spacing: { before: 360 },
        children: [new TextRun('No requirements were selected for this report.')],
      }),
    )
  }

  for (const requirement of requirements) {
    const verifications = verificationsByRequirement.get(requirement.id) ?? []
    const activityIds = new Set(
      (activityLinksByRequirement.get(requirement.id) ?? []).map((link) => link.testActivityId),
    )
    for (const verification of verifications) {
      if (verification.testActivityId) activityIds.add(verification.testActivityId)
    }

    const assessments = assessmentsByRequirement.get(requirement.id) ?? []
    const assessment =
      assessments.find((item) => item.isCurrent) ??
      [...assessments].sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))[0]
    const tagNames = requirement.tagIds
      .map((id) => tagById.get(id)?.name)
      .filter((value): value is string => Boolean(value))

    children.push(
      requirementHeading(requirement),
      fieldParagraph(
        'Status',
        lookupLabel(project.lookups.statuses, requirement.statusId),
      ),
      fieldParagraph(
        'Classification',
        lookupLabel(project.lookups.classifications, requirement.classificationId),
      ),
      fieldParagraph('Type', lookupLabel(project.lookups.types, requirement.typeId)),
      fieldParagraph('Priority', lookupLabel(project.lookups.priorities, requirement.priorityId)),
      fieldParagraph('Derived requirement', requirement.isDerived ? 'Yes' : 'No'),
      fieldParagraph('Tags', tagNames.join(', ') || '—'),
      fieldParagraph(
        'Current assessment',
        assessment
          ? lookupLabel(project.lookups.assessmentResults, assessment.resultId)
          : 'Not Yet Assessed',
      ),
    )

    addTextSection(children, 'Requirement text', requirement.requirementText)
    addTextSection(children, 'Description', requirement.description)
    addTextSection(children, 'Rationale', requirement.rationale)
    addTextSection(children, 'Analyst notes', requirement.analystNotes)
    addTextSection(children, 'Verification notes', requirement.verificationNotes)
    addTextSection(children, 'Assessment narrative', assessment?.narrative)

    addListSection(
      children,
      'Verification records',
      verifications.map((verification) => {
        const method = lookupLabel(
          project.lookups.verificationMethods,
          verification.methodId,
        )
        const status = lookupLabel(
          project.lookups.verificationStatuses,
          verification.statusId,
        )
        const activity = verification.testActivityId
          ? activityById.get(verification.testActivityId)?.title
          : undefined
        return [
          `${method} — ${status}`,
          activity ? `Activity: ${activity}` : '',
          verification.notes ? `Notes: ${verification.notes}` : '',
        ]
          .filter(Boolean)
          .join(' | ')
      }),
    )

    addListSection(
      children,
      'Planned test activities',
      [...activityIds]
        .map((id) => activityById.get(id)?.title)
        .filter((value): value is string => Boolean(value)),
    )

    addListSection(
      children,
      'Sources',
      (sourceLinksByRequirement.get(requirement.id) ?? []).map((link) => {
        const source = sourceById.get(link.sourceId)
        const name = source?.identifier || source?.title || 'Missing source'
        return [
          `${link.type}: ${name}`,
          link.locator ? `Locator: ${link.locator}` : '',
          link.rationale ? `Rationale: ${link.rationale}` : '',
          link.notes ? `Notes: ${link.notes}` : '',
        ]
          .filter(Boolean)
          .join(' | ')
      }),
    )

    addListSection(
      children,
      'Relationships',
      (relationshipsByRequirement.get(requirement.id) ?? []).map((relationship) => {
        const outgoing = relationship.sourceRequirementId === requirement.id
        const otherId = outgoing
          ? relationship.targetRequirementId
          : relationship.sourceRequirementId
        const other = requirementById.get(otherId)
        const type = outgoing
          ? relationship.type
          : RECIPROCAL_RELATIONSHIP[relationship.type] || relationship.type
        return [
          `${type}: ${other?.sourceId || 'Missing requirement'}${other?.shortTitle ? ` — ${other.shortTitle}` : ''}`,
          relationship.rationale ? `Rationale: ${relationship.rationale}` : '',
          relationship.notes ? `Notes: ${relationship.notes}` : '',
        ]
          .filter(Boolean)
          .join(' | ')
      }),
    )

    const evidenceIds = new Set(requirement.evidenceIds)
    for (const verification of verifications) {
      verification.evidenceIds.forEach((id) => evidenceIds.add(id))
    }
    addListSection(
      children,
      'Evidence references',
      [...evidenceIds].map((id) => {
        const evidence = evidenceById.get(id)
        if (!evidence) return `Missing evidence: ${id}`
        return [
          evidence.title || evidence.fileName || 'Untitled evidence',
          evidence.filePath,
          evidence.sectionOrPage ? `Section/page: ${evidence.sectionOrPage}` : '',
        ]
          .filter(Boolean)
          .join(' | ')
      }),
    )

    children.push(
      new Paragraph({
        style: 'RequirementRecordDetails',
        children: [
          new TextRun(
            `Created ${formatTimestamp(requirement.createdAt)} · Modified ${formatTimestamp(requirement.modifiedAt)} · Editor ${requirement.editorName || '—'} · ${requirement.changeSummary || 'No change summary'}`,
          ),
        ],
      }),
    )
  }

  const classification = project.metadata.classificationBanner.trim()
  const headerText = classification || project.metadata.name

  return new Document({
    title: `${project.metadata.name} Requirements Report`,
    subject: 'Operational test requirements',
    creator: 'OT Requirements Manager',
    description: `Requirements report containing ${requirements.length} requirement(s).`,
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 22, color: BODY_COLOR },
          paragraph: { spacing: { after: 120, line: 300 } },
        },
        heading1: {
          run: { font: FONT, size: 32, bold: true, color: HEADING_COLOR },
          paragraph: {
            spacing: { before: 360, after: 200 },
            keepNext: true,
            keepLines: true,
          },
        },
        heading2: {
          run: { font: FONT, size: 26, bold: true, color: HEADING_COLOR },
          paragraph: {
            spacing: { before: 280, after: 140 },
            keepNext: true,
            keepLines: true,
          },
        },
        heading3: {
          run: { font: FONT, size: 24, bold: true, color: DARK_HEADING_COLOR },
          paragraph: {
            spacing: { before: 200, after: 100 },
            keepNext: true,
            keepLines: true,
          },
        },
      },
      paragraphStyles: [
        {
          id: 'RequirementMetadata',
          name: 'Requirement Metadata',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: FONT, size: 20, color: BODY_COLOR },
          paragraph: { spacing: { after: 60, line: 280 } },
        },
        {
          id: 'RequirementRecordDetails',
          name: 'Requirement Record Details',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: FONT, size: 18, color: MUTED_COLOR, italics: true },
          paragraph: {
            spacing: { before: 240, after: 120, line: 280 },
            keepLines: true,
          },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: BULLET_REFERENCE,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: {
                run: { font: FONT, size: 22 },
                paragraph: {
                  indent: { left: 540, hanging: 270 },
                  spacing: { after: 80, line: 300 },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
              header: 708,
              footer: 708,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: headerText,
                    bold: Boolean(classification),
                    color: classification ? BODY_COLOR : MUTED_COLOR,
                    font: FONT,
                    size: 18,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              ...(classification
                ? [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 40 },
                      children: [
                        new TextRun({
                          text: classification,
                          bold: true,
                          font: FONT,
                          size: 18,
                        }),
                      ],
                    }),
                  ]
                : []),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    children: ['Page ', PageNumber.CURRENT],
                    color: MUTED_COLOR,
                    font: FONT,
                    size: 18,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  })
}
