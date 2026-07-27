import { useEffect, useState } from 'react'
import { FuzzySelect } from './FuzzySelect'
import { Modal } from './Modal'
import { RichTextEditor } from './RichText'
import {
  SOURCE_RELATIONSHIP_TYPES,
  type RequirementSourceLink,
  type SourceRelationshipType,
} from '../types/project'

export interface RequirementSourceLinkDraft {
  id?: string
  selectedId: string
  type: SourceRelationshipType
  locator: string
  rationale: string
  notes: string
}

const blankDraft = (): RequirementSourceLinkDraft => ({
  selectedId: '',
  type: 'Cites',
  locator: '',
  rationale: '',
  notes: '',
})

export function RequirementSourceLinkModal({
  open,
  title,
  selectionLabel,
  options,
  initialLink,
  initialSelectedId,
  onClose,
  onSave,
}: {
  open: boolean
  title: string
  selectionLabel: string
  options: { id: string; label: string }[]
  initialLink?: RequirementSourceLink | null
  initialSelectedId?: string
  onClose: () => void
  onSave: (draft: RequirementSourceLinkDraft) => void
}) {
  const [draft, setDraft] = useState<RequirementSourceLinkDraft>(blankDraft)

  useEffect(() => {
    if (!open) return
    setDraft(
      initialLink
        ? {
            id: initialLink.id,
            selectedId: initialSelectedId || '',
            type: initialLink.type,
            locator: initialLink.locator,
            rationale: initialLink.rationale,
            notes: initialLink.notes,
          }
        : blankDraft(),
    )
  }, [open, initialLink, initialSelectedId])

  return (
    <Modal
      open={open}
      title={title}
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!draft.selectedId}
            onClick={() => onSave(draft)}
          >
            Save Relationship
          </button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <span className="field-label">{selectionLabel} *</span>
          <FuzzySelect
            options={options}
            value={draft.selectedId}
            onChange={(selectedId) => setDraft((value) => ({ ...value, selectedId }))}
            placeholder={`Search ${selectionLabel.toLowerCase()}…`}
            emptyLabel="Select…"
            allowClear
          />
        </label>
        <label>
          <span className="field-label">Relationship type</span>
          <select
            className="field-input"
            value={draft.type}
            onChange={(event) =>
              setDraft((value) => ({
                ...value,
                type: event.target.value as SourceRelationshipType,
              }))
            }
          >
            {SOURCE_RELATIONSHIP_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="md:col-span-2">
          <span className="field-label">Locator</span>
          <input
            className="field-input"
            placeholder="Section, paragraph, page, timestamp, or other pinpoint reference"
            value={draft.locator}
            onChange={(event) => setDraft((value) => ({ ...value, locator: event.target.value }))}
          />
        </label>
        <div className="md:col-span-2">
          <span className="field-label">Rationale</span>
          <RichTextEditor
            value={draft.rationale}
            onChange={(rationale) => setDraft((value) => ({ ...value, rationale }))}
          />
        </div>
        <div className="md:col-span-2">
          <span className="field-label">Relationship notes</span>
          <RichTextEditor
            value={draft.notes}
            onChange={(notes) => setDraft((value) => ({ ...value, notes }))}
          />
        </div>
      </div>
    </Modal>
  )
}
