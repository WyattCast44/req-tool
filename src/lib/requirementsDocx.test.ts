import { Packer } from 'docx'
import { describe, expect, it } from 'vitest'
import { createTestProject, createTestRequirement } from '../test/projectFactory'
import { createRequirementsDocx, docxPlainText } from './requirementsDocx'

describe('Word requirement exports', () => {
  it('converts supported rich text to readable document text', () => {
    expect(
      docxPlainText('<p>Detect &amp; <strong>track</strong><br>without delay.</p>'),
    ).toBe('Detect & track without delay.')
  })

  it('packages selected requirements as a valid DOCX archive', async () => {
    const project = createTestProject()
    project.metadata.classificationBanner = 'UNCLASSIFIED'
    const selected = createTestRequirement(project, 'req-selected', {
      shortTitle: 'Selected requirement',
    })
    project.requirements = [
      selected,
      createTestRequirement(project, 'req-not-selected'),
    ]

    const document = createRequirementsDocx({
      project,
      requirementIds: [selected.id],
      generatedAt: '2026-07-27T12:00:00.000Z',
    })
    const buffer = await Packer.toBuffer(document)

    expect(buffer.byteLength).toBeGreaterThan(1_000)
    expect(buffer.subarray(0, 2).toString()).toBe('PK')
  })
})
