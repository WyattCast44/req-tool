import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FuzzySelect } from '../components/FuzzySelect'
import { FuzzyMultiSelect } from '../components/FuzzyMultiSelect'
import { RelationshipGraph } from '../components/RelationshipGraph'
import { RequirementHoverPreview } from '../components/RequirementHoverPreview'
import { PageHeader } from '../components/PageHeader'
import { useProjectStore } from '../store/projectStore'
import {
  RELATIONSHIP_TYPES,
  RECIPROCAL_RELATIONSHIP,
  SOURCE_RELATIONSHIP_TYPES,
} from '../types/project'
import { lookupLabel } from '../lib/defaults'
import { countDistinctLinkedRequirements } from '../lib/sourceLinks'
import { buildGraphNeighborhood, type GraphNode } from '../lib/relationshipGraph'
import { useGraphUrlState } from '../lib/urlState'

interface ClientPoint {
  x: number
  y: number
}

function useStableStringList<T extends string>(values: readonly T[]): readonly T[] {
  const key = values.join('\u0000')
  const stableRef = useRef<{ key: string; values: readonly T[] } | null>(null)
  if (!stableRef.current || stableRef.current.key !== key) {
    stableRef.current = { key, values }
  }
  return stableRef.current.values
}

export function GraphPage() {
  const project = useProjectStore((s) => s.project)!
  const {
    focusId: graphFocusId,
    focusKind: graphFocusKind,
    depth: graphDepth,
    relationshipTypes: graphTypes,
    sourceLinkTypes,
    statusIds: statusFilter,
    tagIds: tagFilter,
    selectedEdgeId: selectedEdge,
    setFocus,
    setDepth: setGraphDepth,
    setRelationshipTypes: setGraphTypes,
    setSourceLinkTypes,
    setStatusIds: setStatusFilter,
    setTagIds: setTagFilter,
    setSelectedEdge,
  } = useGraphUrlState()
  const setGraphFocus = (id: string | null) => setFocus('requirement', id)
  const setGraphSourceFocus = (id: string | null) => setFocus('source', id)
  const [hoveredRequirementId, setHoveredRequirementId] = useState<string | null>(null)
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null)
  const graphPanelRef = useRef<HTMLDivElement>(null)
  const hoverClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelRequirementHoverClear = () => {
    if (hoverClearTimerRef.current) {
      clearTimeout(hoverClearTimerRef.current)
      hoverClearTimerRef.current = null
    }
  }

  const clearRequirementHover = () => {
    cancelRequirementHoverClear()
    setHoveredRequirementId(null)
    setHoverPoint(null)
  }

  const scheduleRequirementHoverClear = (delayMs = 450) => {
    cancelRequirementHoverClear()
    hoverClearTimerRef.current = setTimeout(() => {
      hoverClearTimerRef.current = null
      setHoveredRequirementId(null)
      setHoverPoint(null)
    }, delayMs)
  }

  const positionRequirementHover = (point: ClientPoint) => {
    const panel = graphPanelRef.current
    if (!panel) return
    const panelRect = panel.getBoundingClientRect()
    setHoverPoint({
      x: point.x - panelRect.left,
      y: point.y - panelRect.top,
    })
  }

  const showRequirementHover = (requirementId: string, point: ClientPoint) => {
    cancelRequirementHoverClear()
    setHoveredRequirementId(requirementId)
    positionRequirementHover(point)
  }

  useEffect(() => {
    return () => {
      cancelRequirementHoverClear()
    }
  }, [])

  const sources = project.sources ?? []
  const sourceLinks = project.requirementSourceLinks ?? []

  const focusKind = graphFocusKind
  const focusId =
    graphFocusId ||
    (focusKind === 'source' ? sources[0]?.id || null : project.requirements[0]?.id || null)
  const stableGraphTypes = useStableStringList(graphTypes)
  const stableSourceLinkTypes = useStableStringList(sourceLinkTypes)
  const stableStatusFilter = useStableStringList(statusFilter)
  const stableTagFilter = useStableStringList(tagFilter)

  const requirementOptions = useMemo(
    () =>
      project.requirements.map((requirement) => ({
        id: requirement.id,
        label: `${requirement.sourceId} — ${requirement.shortTitle || 'Untitled'}`,
      })),
    [project.requirements],
  )

  const sourceOptions = useMemo(
    () =>
      (project.sources ?? []).map((source) => ({
        id: source.id,
        label: `${source.identifier ? `${source.identifier} — ` : ''}${source.title}`,
        keywords: [source.sourceType, source.publisher, source.version].filter(Boolean).join(' '),
      })),
    [project.sources],
  )

  const neighborhood = useMemo(
    () =>
      buildGraphNeighborhood({
        project,
        focusId,
        focusKind,
        depth: graphDepth,
        relationshipTypes: stableGraphTypes,
        sourceLinkTypes: stableSourceLinkTypes,
        statusIds: stableStatusFilter,
        tagIds: stableTagFilter,
      }),
    [
      focusId,
      focusKind,
      graphDepth,
      project,
      stableGraphTypes,
      stableSourceLinkTypes,
      stableStatusFilter,
      stableTagFilter,
    ],
  )

  const selectedEdgeObj = selectedEdge
    ? neighborhood.edges.find((edge) => edge.id === selectedEdge) || null
    : null

  const focusedSource =
    focusKind === 'source' && focusId ? sources.find((source) => source.id === focusId) || null : null
  const focusedRequirement =
    focusKind === 'requirement' && focusId
      ? project.requirements.find((requirement) => requirement.id === focusId) || null
      : null
  const hoveredRequirement = hoveredRequirementId
    ? project.requirements.find((requirement) => requirement.id === hoveredRequirementId) || null
    : null

  const hoverPreviewStyle = useMemo(() => {
    if (!hoverPoint || !graphPanelRef.current) return undefined
    const panelWidth = graphPanelRef.current.clientWidth
    const panelHeight = graphPanelRef.current.clientHeight
    const cardWidth = 320
    const cardHeight = 280
    const gap = 18
    let left = hoverPoint.x + gap
    let top = hoverPoint.y - 28
    if (left + cardWidth > panelWidth - 8) left = hoverPoint.x - cardWidth - gap
    if (top + cardHeight > panelHeight - 8) top = panelHeight - cardHeight - 8
    left = Math.max(8, left)
    top = Math.max(8, top)
    return { left, top }
  }, [hoverPoint])

  return (
    <div className="space-y-2.5">
      <PageHeader
        title="Relationship Graph"
        subtitle={
          focusKind === 'source'
            ? 'Focused neighborhood around a selected source and its linked requirements.'
            : 'Focused neighborhood around a selected requirement. Full-project graphs are intentionally avoided.'
        }
      />

      <div className="grid gap-3 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="space-y-3">
          <section className="panel">
            <div className="panel-header">
              <h3>Focus</h3>
            </div>
            <div className="panel-body space-y-3">
              <div>
                <span className="field-label">Center on</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={`btn flex-1 ${focusKind === 'requirement' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => {
                      const nextId =
                        graphFocusKind === 'requirement' ? focusId : project.requirements[0]?.id || null
                      setGraphFocus(nextId)
                      setSelectedEdge(null)
                    }}
                  >
                    Requirement
                  </button>
                  <button
                    type="button"
                    className={`btn flex-1 ${focusKind === 'source' ? 'btn-primary' : 'btn-secondary'}`}
                    disabled={sources.length === 0}
                    onClick={() => {
                      const nextId = graphFocusKind === 'source' ? focusId : sources[0]?.id || null
                      setGraphSourceFocus(nextId)
                      setSelectedEdge(null)
                    }}
                  >
                    Source
                  </button>
                </div>
              </div>
              <label className="block">
                <span className="field-label">
                  {focusKind === 'source' ? 'Center source' : 'Center requirement'}
                </span>
                {focusKind === 'source' ? (
                  <FuzzySelect
                    options={sourceOptions}
                    value={focusId || ''}
                    onChange={(id) => {
                      setGraphSourceFocus(id || null)
                      setSelectedEdge(null)
                    }}
                    placeholder="Search sources…"
                  />
                ) : (
                  <FuzzySelect
                    options={requirementOptions}
                    value={focusId || ''}
                    onChange={(id) => {
                      setGraphFocus(id || null)
                      setSelectedEdge(null)
                    }}
                    placeholder="Search requirements…"
                  />
                )}
              </label>
              <label className="block">
                <span className="field-label">Relationship depth</span>
                <select
                  className="field-input"
                  value={graphDepth}
                  onChange={(e) => setGraphDepth(Number(e.target.value))}
                >
                  {[1, 2, 3].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Filters</h3>
            </div>
            <div className="panel-body space-y-3">
              <label className="block">
                <span className="field-label">
                  Status filter
                  {statusFilter.length > 0 ? (
                    <span className="ml-1 text-[var(--color-accent)]">({statusFilter.length})</span>
                  ) : null}
                </span>
                <FuzzyMultiSelect
                  options={project.lookups.statuses.map((status) => ({
                    id: status.id,
                    label: status.value,
                  }))}
                  value={statusFilter}
                  onChange={setStatusFilter}
                  placeholder="Search statuses…"
                />
              </label>
              <label className="block">
                <span className="field-label">
                  Tag filter
                  {tagFilter.length > 0 ? (
                    <span className="ml-1 text-[var(--color-accent)]">({tagFilter.length})</span>
                  ) : null}
                </span>
                <FuzzyMultiSelect
                  options={project.tags.map((tag) => ({
                    id: tag.id,
                    label: tag.name,
                  }))}
                  value={tagFilter}
                  onChange={setTagFilter}
                  placeholder="Search tags…"
                />
              </label>
            </div>
          </section>

          {focusKind === 'source' && (
            <section className="panel">
              <div className="panel-header">
                <h3>Source links</h3>
              </div>
              <div className="panel-body">
                <div className="flex flex-col gap-1.5">
                  {SOURCE_RELATIONSHIP_TYPES.map((type) => (
                    <label key={type} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={sourceLinkTypes.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) setSourceLinkTypes([...sourceLinkTypes, type])
                          else setSourceLinkTypes(sourceLinkTypes.filter((t) => t !== type))
                        }}
                      />
                      {type}
                    </label>
                  ))}
                </div>
              </div>
            </section>
          )}

          <section className="panel">
            <div className="panel-header">
              <h3>Requirement relationships</h3>
            </div>
            <div className="panel-body">
              <div className="flex flex-col gap-1.5">
                {RELATIONSHIP_TYPES.map((type) => (
                  <label key={type} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={graphTypes.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) setGraphTypes([...graphTypes, type])
                        else setGraphTypes(graphTypes.filter((t) => t !== type))
                      }}
                    />
                    {type}
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="panel text-sm">
            <div className="panel-header">
              <h3>{focusKind === 'source' ? 'Selected source' : 'Selected requirement'}</h3>
            </div>
            <div className="panel-body">
              {focusedSource ? (
                <div className="space-y-1">
                  <div className="font-semibold">
                    {focusedSource.identifier ? `${focusedSource.identifier} — ` : ''}
                    {focusedSource.title}
                  </div>
                  <div>Type: {focusedSource.sourceType || '—'}</div>
                  <div>
                    Linked requirements:{' '}
                    {countDistinctLinkedRequirements(sourceLinks, focusedSource.id)}
                  </div>
                  <Link className="btn btn-secondary mt-2 inline-flex" to={`/sources/${focusedSource.id}`}>
                    Open detail
                  </Link>
                </div>
              ) : focusedRequirement ? (
                <div className="space-y-1">
                  <div className="font-semibold">
                    {focusedRequirement.sourceId} — {focusedRequirement.shortTitle || 'Untitled'}
                  </div>
                  <div>Status: {lookupLabel(project.lookups.statuses, focusedRequirement.statusId)}</div>
                  <Link
                    className="btn btn-secondary mt-2 inline-flex"
                    to={`/requirements/${focusedRequirement.id}`}
                  >
                    Open detail
                  </Link>
                </div>
              ) : (
                <p>Nothing selected.</p>
              )}
            </div>
          </section>

          <section className="panel text-sm">
            <div className="panel-header">
              <h3>Selected relationship</h3>
            </div>
            <div className="panel-body">
              {selectedEdgeObj?.kind === 'relationship' ? (
                <div className="space-y-1">
                  <div>
                    {
                      project.requirements.find(
                        (r) => r.id === selectedEdgeObj.relationship.sourceRequirementId,
                      )?.sourceId
                    }{' '}
                    →{' '}
                    {
                      project.requirements.find(
                        (r) => r.id === selectedEdgeObj.relationship.targetRequirementId,
                      )?.sourceId
                    }
                  </div>
                  <div>
                    Type: {selectedEdgeObj.relationship.type}
                    {RECIPROCAL_RELATIONSHIP[selectedEdgeObj.relationship.type]
                      ? ` (reciprocal display: ${RECIPROCAL_RELATIONSHIP[selectedEdgeObj.relationship.type]})`
                      : ''}
                  </div>
                  <div>Rationale: {selectedEdgeObj.relationship.rationale || '—'}</div>
                  <div>Notes: {selectedEdgeObj.relationship.notes || '—'}</div>
                </div>
              ) : selectedEdgeObj?.kind === 'source-link' ? (
                <div className="space-y-1">
                  <div>
                    {project.requirements.find((r) => r.id === selectedEdgeObj.link.requirementId)
                      ?.sourceId || 'Requirement'}{' '}
                    →{' '}
                    {sources.find((source) => source.id === selectedEdgeObj.link.sourceId)?.title ||
                      'Source'}
                  </div>
                  <div>Type: {selectedEdgeObj.link.type}</div>
                  <div>Locator: {selectedEdgeObj.link.locator || '—'}</div>
                  <div>
                    Rationale: {selectedEdgeObj.link.rationale?.replace(/<[^>]+>/g, ' ').trim() || '—'}
                  </div>
                  <div>Notes: {selectedEdgeObj.link.notes?.replace(/<[^>]+>/g, ' ').trim() || '—'}</div>
                </div>
              ) : (
                <p className="text-[var(--color-ink-muted)]">Click an edge to inspect rationale.</p>
              )}
            </div>
          </section>
        </aside>

        <div
          ref={graphPanelRef}
          className="panel relative overflow-hidden p-2 xl:sticky xl:top-[calc(var(--top-navbar-height,0px)+1rem)] xl:self-start"
          onMouseLeave={clearRequirementHover}
        >
          {neighborhood.nodes.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-[var(--color-ink-muted)]">
              {focusKind === 'source'
                ? 'No linked requirements for this source with the current filters.'
                : 'No requirements to display.'}
            </div>
          ) : (
            <RelationshipGraph
              neighborhood={neighborhood}
              selectedEdgeId={selectedEdge}
              onSelectNode={(node: GraphNode) => {
                if (node.kind === 'source') {
                  clearRequirementHover()
                  setGraphSourceFocus(node.id)
                } else {
                  setGraphFocus(node.id)
                }
              }}
              onOpenNode={(node: GraphNode) => {
                window.location.hash =
                  node.kind === 'source'
                    ? `#/sources/${node.id}`
                    : `#/requirements/${node.id}`
              }}
              onSelectEdge={setSelectedEdge}
              onRequirementHover={showRequirementHover}
              onRequirementMove={positionRequirementHover}
              onRequirementLeave={() => scheduleRequirementHoverClear(450)}
            />
          )}
          {hoveredRequirement && hoverPreviewStyle && (
            <div
              className="absolute z-20"
              style={hoverPreviewStyle}
              onMouseEnter={cancelRequirementHoverClear}
              onMouseLeave={() => scheduleRequirementHoverClear(200)}
            >
              <RequirementHoverPreview requirement={hoveredRequirement} project={project} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
