import { useMemo } from 'react'
import { FuzzyMultiSelect } from './FuzzyMultiSelect'
import { useProjectStore } from '../store/projectStore'
import type { ProjectData, RequirementFilters, TagLogic } from '../types/project'
import { lookupLabel } from '../lib/defaults'
import { useRequirementViewState } from '../lib/urlState'

function MultiSelect({
  label,
  options,
  values,
  onChange,
}: {
  label: string
  options: { id: string; label: string }[]
  values: string[]
  onChange: (values: string[]) => void
}) {
  return (
    <label className="block">
      <span className="field-label">
        {label}
        {values.length > 0 ? (
          <span className="ml-1 text-[var(--color-accent)]">({values.length})</span>
        ) : null}
      </span>
      <FuzzyMultiSelect
        options={options}
        value={values}
        onChange={onChange}
        placeholder={`Search ${label.toLowerCase()}…`}
      />
    </label>
  )
}

interface ActiveChip {
  id: string
  label: string
  onClear: () => void
}

function lookupIds(
  project: ProjectData,
  key: keyof ProjectData['lookups'],
  ids: string[],
): string {
  return ids.map((id) => lookupLabel(project.lookups[key], id)).join(', ')
}

function buildActiveChips(
  project: ProjectData,
  filters: RequirementFilters,
  tagLogic: TagLogic,
  setFilters: (patch: Partial<RequirementFilters>) => void,
  setTagLogic: (logic: TagLogic) => void,
): ActiveChip[] {
  const chips: ActiveChip[] = []

  const pushMulti = (
    key: keyof RequirementFilters,
    fieldLabel: string,
    values: string[],
    format: (ids: string[]) => string,
  ) => {
    if (!values.length) return
    chips.push({
      id: String(key),
      label: `${fieldLabel}: ${format(values)}`,
      onClear: () => setFilters({ [key]: [] } as Partial<RequirementFilters>),
    })
  }

  pushMulti('statusIds', 'Status', filters.statusIds, (ids) => lookupIds(project, 'statuses', ids))
  pushMulti('classificationIds', 'Classification', filters.classificationIds, (ids) =>
    lookupIds(project, 'classifications', ids),
  )
  pushMulti('typeIds', 'Type', filters.typeIds, (ids) => lookupIds(project, 'types', ids))
  pushMulti('priorityIds', 'Priority', filters.priorityIds, (ids) =>
    lookupIds(project, 'priorities', ids),
  )
  pushMulti('verificationMethodIds', 'Verification', filters.verificationMethodIds, (ids) =>
    lookupIds(project, 'verificationMethods', ids),
  )
  pushMulti('assessmentResultIds', 'Assessment', filters.assessmentResultIds, (ids) =>
    lookupIds(project, 'assessmentResults', ids),
  )
  pushMulti('testActivityIds', 'Test activity', filters.testActivityIds, (ids) =>
    ids
      .map((id) => project.testActivities.find((t) => t.id === id)?.title || id)
      .join(', '),
  )
  pushMulti('testPhaseIds', 'Test phase', filters.testPhaseIds, (ids) =>
    lookupIds(project, 'testPhases', ids),
  )
  pushMulti('owners', 'Owner', filters.owners, (ids) => ids.join(', '))
  pushMulti('sourceIds', 'Source', filters.sourceIds, (ids) =>
    ids
      .map((id) => {
        const source = (project.sources ?? []).find((item) => item.id === id)
        return source?.identifier || source?.title || id
      })
      .join(', '),
  )
  pushMulti('tagIds', 'Tags', filters.tagIds, (ids) =>
    ids.map((id) => project.tags.find((t) => t.id === id)?.name || id).join(', '),
  )

  if (filters.tagIds.length && tagLogic !== 'any') {
    const logicLabel =
      tagLogic === 'all' ? 'Match all tags' : tagLogic === 'exclude' ? 'Exclude tags' : tagLogic
    chips.push({
      id: 'tagLogic',
      label: `Tag logic: ${logicLabel}`,
      onClear: () => setTagLogic('any'),
    })
  }

  if (filters.createdFrom) {
    chips.push({
      id: 'createdFrom',
      label: `Created from: ${filters.createdFrom}`,
      onClear: () => setFilters({ createdFrom: '' }),
    })
  }
  if (filters.createdTo) {
    chips.push({
      id: 'createdTo',
      label: `Created to: ${filters.createdTo}`,
      onClear: () => setFilters({ createdTo: '' }),
    })
  }
  if (filters.modifiedFrom) {
    chips.push({
      id: 'modifiedFrom',
      label: `Modified from: ${filters.modifiedFrom}`,
      onClear: () => setFilters({ modifiedFrom: '' }),
    })
  }
  if (filters.modifiedTo) {
    chips.push({
      id: 'modifiedTo',
      label: `Modified to: ${filters.modifiedTo}`,
      onClear: () => setFilters({ modifiedTo: '' }),
    })
  }
  if (filters.gapKey) {
    chips.push({
      id: 'gapKey',
      label: `Gap: ${filters.gapKey}`,
      onClear: () => setFilters({ gapKey: null }),
    })
  }

  return chips
}

export function FilterPanel() {
  const project = useProjectStore((s) => s.project)!
  const {
    searchQuery,
    filters,
    tagLogic,
    setSearchQuery,
    setFilters,
    setTagLogic,
    resetFilters,
    activeSavedViewId,
    applySavedView,
    clearSavedView,
  } = useRequirementViewState()
  const savedViews = project.savedViews

  const owners = Array.from(
    new Set(project.testActivities.map((t) => t.owner).filter(Boolean)),
  ).sort()
  const sources = (project.sources ?? [])
    .map((source) => ({
      id: source.id,
      label: `${source.identifier ? `${source.identifier} — ` : ''}${source.title}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const activeChips = useMemo(
    () => buildActiveChips(project, filters, tagLogic, setFilters, setTagLogic),
    [project, filters, tagLogic, setFilters, setTagLogic],
  )
  const activeCount = activeChips.length
  const hasAnyFilter = activeCount > 0 || Boolean(searchQuery.trim())

  return (
    <div className="panel space-y-2 p-2.5">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[14rem] flex-1">
          <span className="field-label">List search</span>
          <input
            className="field-input"
            value={searchQuery}
            placeholder="Filter this list (ID, title, text, notes…)"
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>
        <label className="min-w-[10rem]">
          <span className="field-label">Saved view</span>
          <select
            className="field-input"
            value={activeSavedViewId || ''}
            onChange={(e) => {
              if (!e.target.value) clearSavedView()
              else {
                const view = savedViews.find((item) => item.id === e.target.value)
                if (view) applySavedView(view)
              }
            }}
          >
            <option value="">None</option>
            {savedViews.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={resetFilters}
          disabled={!hasAnyFilter && !activeSavedViewId}
          title="Clear list search, field filters, tags, and saved view"
        >
          Clear Filters
        </button>
      </div>

      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded border border-[var(--color-line-strong)] bg-[var(--color-accent-soft)] px-2 py-1.5">
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)]">
            {activeCount} field filter{activeCount === 1 ? '' : 's'}
          </span>
          {activeChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="inline-flex max-w-full items-center gap-1 rounded border border-[var(--color-line-strong)] bg-white px-1.5 py-0.5 text-left text-[0.7rem] text-[var(--color-ink)] hover:border-[var(--color-accent)]"
              onClick={chip.onClear}
              title={`Clear ${chip.label}`}
            >
              <span className="truncate">{chip.label}</span>
              <span className="shrink-0 text-[var(--color-ink-muted)]" aria-hidden>
                ×
              </span>
            </button>
          ))}
        </div>
      )}

      <details>
        <summary className="cursor-pointer text-[0.72rem] font-semibold text-[var(--color-accent)]">
          Field filters & tags
          {activeCount > 0 ? (
            <span className="ml-1.5 rounded bg-[var(--color-accent)] px-1.5 py-0.5 text-[0.65rem] font-bold tracking-normal text-white">
              {activeCount} active
            </span>
          ) : (
            <span className="ml-1.5 font-normal text-[var(--color-ink-muted)]">none applied</span>
          )}
        </summary>
        <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <MultiSelect
            label="Status"
            options={project.lookups.statuses.filter((s) => s.active).map((s) => ({ id: s.id, label: s.value }))}
            values={filters.statusIds}
            onChange={(statusIds) => setFilters({ statusIds })}
          />
          <MultiSelect
            label="Classification"
            options={project.lookups.classifications.filter((s) => s.active).map((s) => ({ id: s.id, label: s.value }))}
            values={filters.classificationIds}
            onChange={(classificationIds) => setFilters({ classificationIds })}
          />
          <MultiSelect
            label="Type"
            options={project.lookups.types.filter((s) => s.active).map((s) => ({ id: s.id, label: s.value }))}
            values={filters.typeIds}
            onChange={(typeIds) => setFilters({ typeIds })}
          />
          <MultiSelect
            label="Priority"
            options={project.lookups.priorities.filter((s) => s.active).map((s) => ({ id: s.id, label: s.value }))}
            values={filters.priorityIds}
            onChange={(priorityIds) => setFilters({ priorityIds })}
          />
          <MultiSelect
            label="Verification method"
            options={project.lookups.verificationMethods.filter((s) => s.active).map((s) => ({ id: s.id, label: s.value }))}
            values={filters.verificationMethodIds}
            onChange={(verificationMethodIds) => setFilters({ verificationMethodIds })}
          />
          <MultiSelect
            label="Assessment result"
            options={project.lookups.assessmentResults.filter((s) => s.active).map((s) => ({ id: s.id, label: s.value }))}
            values={filters.assessmentResultIds}
            onChange={(assessmentResultIds) => setFilters({ assessmentResultIds })}
          />
          <MultiSelect
            label="Test activity"
            options={project.testActivities.map((t) => ({ id: t.id, label: t.title }))}
            values={filters.testActivityIds}
            onChange={(testActivityIds) => setFilters({ testActivityIds })}
          />
          <MultiSelect
            label="Test phase"
            options={project.lookups.testPhases.filter((s) => s.active).map((s) => ({ id: s.id, label: s.value }))}
            values={filters.testPhaseIds}
            onChange={(testPhaseIds) => setFilters({ testPhaseIds })}
          />
          <MultiSelect
            label="Owner"
            options={owners.map((o) => ({ id: o, label: o }))}
            values={filters.owners}
            onChange={(ownersVals) => setFilters({ owners: ownersVals })}
          />
          <MultiSelect
            label="Source"
            options={sources}
            values={filters.sourceIds}
            onChange={(sourceIds) => setFilters({ sourceIds })}
          />
          <MultiSelect
            label="Tags"
            options={project.tags.filter((t) => t.active).map((t) => ({ id: t.id, label: t.name }))}
            values={filters.tagIds}
            onChange={(tagIds) => setFilters({ tagIds })}
          />
          <label className="block">
            <span className="field-label">Tag logic</span>
            <select
              className="field-input"
              value={tagLogic}
              onChange={(e) => setTagLogic(e.target.value as TagLogic)}
            >
              <option value="any">Match any selected tag</option>
              <option value="all">Match all selected tags</option>
              <option value="exclude">Exclude selected tags</option>
            </select>
          </label>
          <label className="block">
            <span className="field-label">Created from</span>
            <input
              type="date"
              className="field-input"
              value={filters.createdFrom}
              onChange={(e) => setFilters({ createdFrom: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="field-label">Created to</span>
            <input
              type="date"
              className="field-input"
              value={filters.createdTo}
              onChange={(e) => setFilters({ createdTo: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="field-label">Modified from</span>
            <input
              type="date"
              className="field-input"
              value={filters.modifiedFrom}
              onChange={(e) => setFilters({ modifiedFrom: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="field-label">Modified to</span>
            <input
              type="date"
              className="field-input"
              value={filters.modifiedTo}
              onChange={(e) => setFilters({ modifiedTo: e.target.value })}
            />
          </label>
        </div>
      </details>
    </div>
  )
}
