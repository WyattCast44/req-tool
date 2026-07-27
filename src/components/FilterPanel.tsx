import { useProjectStore } from '../store/projectStore'
import type { TagLogic } from '../types/project'

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
      <span className="field-label">{label}</span>
      <select
        multiple
        className="field-input min-h-[4.25rem] text-[0.75rem]"
        value={values}
        onChange={(e) =>
          onChange(Array.from(e.target.selectedOptions).map((o) => o.value))
        }
      >
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function FilterPanel() {
  const project = useProjectStore((s) => s.project)!
  const searchQuery = useProjectStore((s) => s.searchQuery)
  const filters = useProjectStore((s) => s.filters)
  const tagLogic = useProjectStore((s) => s.tagLogic)
  const setSearchQuery = useProjectStore((s) => s.setSearchQuery)
  const setFilters = useProjectStore((s) => s.setFilters)
  const setTagLogic = useProjectStore((s) => s.setTagLogic)
  const resetFilters = useProjectStore((s) => s.resetFilters)
  const savedViews = project.savedViews
  const activeSavedViewId = useProjectStore((s) => s.activeSavedViewId)
  const applySavedView = useProjectStore((s) => s.applySavedView)
  const clearSavedView = useProjectStore((s) => s.clearSavedView)

  const owners = Array.from(
    new Set(project.testActivities.map((t) => t.owner).filter(Boolean)),
  ).sort()
  const sourceDocuments = Array.from(
    new Set(project.requirements.map((r) => r.sourceDocument).filter(Boolean)),
  ).sort()

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
              else applySavedView(e.target.value)
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
        <button type="button" className="btn btn-secondary" onClick={resetFilters}>
          Clear
        </button>
      </div>

      <details>
        <summary className="cursor-pointer text-[0.72rem] font-semibold text-[var(--color-accent)]">
          Field filters & tags
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
            label="Source document"
            options={sourceDocuments.map((o) => ({ id: o, label: o }))}
            values={filters.sourceDocuments}
            onChange={(sourceDocumentsVals) => setFilters({ sourceDocuments: sourceDocumentsVals })}
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
        {filters.gapKey && (
          <p className="mt-3 text-sm text-[var(--color-warn)]">
            Gap filter active: <strong>{filters.gapKey}</strong>
          </p>
        )}
      </details>
    </div>
  )
}
