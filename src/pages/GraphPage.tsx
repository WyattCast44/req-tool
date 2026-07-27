import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FuzzySelect } from '../components/FuzzySelect'
import { FuzzyMultiSelect } from '../components/FuzzyMultiSelect'
import { RequirementHoverPreview } from '../components/RequirementHoverPreview'
import { useProjectStore } from '../store/projectStore'
import {
  RELATIONSHIP_TYPES,
  RECIPROCAL_RELATIONSHIP,
  SOURCE_RELATIONSHIP_TYPES,
  type RequirementRelationship,
  type RequirementSourceLink,
} from '../types/project'
import { lookupLabel } from '../lib/defaults'
import {
  countDistinctLinkedRequirements,
  requirementSourceLinkEndpoints,
} from '../lib/sourceLinks'
import { useGraphUrlState } from '../lib/urlState'

interface NodePos {
  id: string
  x: number
  y: number
  vx: number
  vy: number
}

type GraphNode =
  | { id: string; kind: 'requirement' }
  | { id: string; kind: 'source' }

type GraphEdge =
  | {
      kind: 'relationship'
      id: string
      fromId: string
      toId: string
      type: string
      relationship: RequirementRelationship
    }
  | {
      kind: 'source-link'
      id: string
      fromId: string
      toId: string
      type: string
      link: RequirementSourceLink
    }

interface EdgePoint {
  x: number
  y: number
}

function boundaryPoint(
  node: GraphNode,
  position: NodePos,
  toward: NodePos,
  focused: boolean,
): EdgePoint {
  const dx = toward.x - position.x
  const dy = toward.y - position.y
  const distance = Math.hypot(dx, dy)
  if (distance === 0) return { x: position.x, y: position.y }

  const unitX = dx / distance
  const unitY = dy / distance
  if (node.kind === 'requirement') {
    const radius = focused ? 28 : 22
    return {
      x: position.x + unitX * radius,
      y: position.y + unitY * radius,
    }
  }

  const horizontalDistance = unitX === 0 ? Number.POSITIVE_INFINITY : 36 / Math.abs(unitX)
  const verticalDistance = unitY === 0 ? Number.POSITIVE_INFINITY : 22 / Math.abs(unitY)
  const edgeDistance = Math.min(horizontalDistance, verticalDistance)
  return {
    x: position.x + unitX * edgeDistance,
    y: position.y + unitY * edgeDistance,
  }
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
  const [positions, setPositions] = useState<Record<string, NodePos>>({})
  const [hoveredRequirementId, setHoveredRequirementId] = useState<string | null>(null)
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null)
  const frameRef = useRef<number | null>(null)
  const graphPanelRef = useRef<HTMLDivElement>(null)
  const graphSvgRef = useRef<SVGSVGElement>(null)
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

  const anchorPreviewToNode = (requirementId: string) => {
    const panel = graphPanelRef.current
    const svg = graphSvgRef.current
    const node = positions[requirementId]
    if (!panel || !svg || !node) return

    const ctm = svg.getScreenCTM()
    if (!ctm) return
    const point = svg.createSVGPoint()
    point.x = node.x
    point.y = node.y
    const screen = point.matrixTransform(ctm)
    const panelRect = panel.getBoundingClientRect()
    setHoverPoint({
      x: screen.x - panelRect.left,
      y: screen.y - panelRect.top,
    })
  }

  const showRequirementHover = (requirementId: string) => {
    cancelRequirementHoverClear()
    setHoveredRequirementId(requirementId)
    anchorPreviewToNode(requirementId)
  }

  useEffect(() => {
    return () => {
      cancelRequirementHoverClear()
    }
  }, [])

  // Keep the anchored preview beside the node while the layout animates.
  useEffect(() => {
    if (!hoveredRequirementId) return
    const panel = graphPanelRef.current
    const svg = graphSvgRef.current
    const node = positions[hoveredRequirementId]
    if (!panel || !svg || !node) return

    const ctm = svg.getScreenCTM()
    if (!ctm) return
    const point = svg.createSVGPoint()
    point.x = node.x
    point.y = node.y
    const screen = point.matrixTransform(ctm)
    const panelRect = panel.getBoundingClientRect()
    setHoverPoint({
      x: screen.x - panelRect.left,
      y: screen.y - panelRect.top,
    })
  }, [hoveredRequirementId, positions])

  const sources = project.sources ?? []
  const sourceLinks = project.requirementSourceLinks ?? []

  const focusKind = graphFocusKind
  const focusId =
    graphFocusId ||
    (focusKind === 'source' ? sources[0]?.id || null : project.requirements[0]?.id || null)

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

  const neighborhood = useMemo(() => {
    const sourcesList = project.sources ?? []
    const sourceLinksList = project.requirementSourceLinks ?? []
    const empty = {
      nodes: [] as GraphNode[],
      edges: [] as GraphEdge[],
      focusNodeId: null as string | null,
    }
    if (!focusId) return empty

    const allowedRel = new Set(graphTypes)
    const allowedSourceLinks = new Set(sourceLinkTypes)
    const reqNodeIds = new Set<string>()
    const edges: GraphEdge[] = []
    let focusNodeId = focusId

    if (focusKind === 'source') {
      const source = sourcesList.find((item) => item.id === focusId)
      if (!source) return empty
      focusNodeId = source.id

      const linked = sourceLinksList.filter(
        (link) => link.sourceId === focusId && allowedSourceLinks.has(link.type),
      )
      for (const link of linked) {
        reqNodeIds.add(link.requirementId)
        edges.push({
          kind: 'source-link',
          id: link.id,
          ...requirementSourceLinkEndpoints(link),
          type: link.type,
          link,
        })
      }

      // Depth 1 = source + directly linked requirements.
      // Deeper levels expand requirement relationships from those seeds.
      let frontier = Array.from(reqNodeIds)
      for (let depth = 1; depth < graphDepth; depth += 1) {
        const next: string[] = []
        for (const id of frontier) {
          for (const rel of project.relationships) {
            if (!allowedRel.has(rel.type)) continue
            let other: string | null = null
            if (rel.sourceRequirementId === id) other = rel.targetRequirementId
            else if (rel.targetRequirementId === id) other = rel.sourceRequirementId
            if (other && !reqNodeIds.has(other)) {
              reqNodeIds.add(other)
              next.push(other)
            }
          }
        }
        frontier = next
      }
    } else {
      reqNodeIds.add(focusId)
      let frontier = [focusId]
      for (let depth = 0; depth < graphDepth; depth += 1) {
        const next: string[] = []
        for (const id of frontier) {
          for (const rel of project.relationships) {
            if (!allowedRel.has(rel.type)) continue
            let other: string | null = null
            if (rel.sourceRequirementId === id) other = rel.targetRequirementId
            else if (rel.targetRequirementId === id) other = rel.sourceRequirementId
            if (other && !reqNodeIds.has(other)) {
              reqNodeIds.add(other)
              next.push(other)
            }
          }
        }
        frontier = next
      }
    }

    let requirementIds = Array.from(reqNodeIds)
    if (statusFilter.length) {
      requirementIds = requirementIds.filter((id) => {
        const req = project.requirements.find((r) => r.id === id)
        return req && statusFilter.includes(req.statusId)
      })
      if (focusKind === 'requirement' && !requirementIds.includes(focusId)) {
        requirementIds = [focusId, ...requirementIds]
      }
    }
    if (tagFilter.length) {
      requirementIds = requirementIds.filter((id) => {
        const req = project.requirements.find((r) => r.id === id)
        return req && tagFilter.some((t) => req.tagIds.includes(t))
      })
      if (focusKind === 'requirement' && !requirementIds.includes(focusId)) {
        requirementIds = [focusId, ...requirementIds]
      }
    }

    const visibleReqIds = new Set(requirementIds)
    for (const rel of project.relationships) {
      if (!allowedRel.has(rel.type)) continue
      if (!visibleReqIds.has(rel.sourceRequirementId) || !visibleReqIds.has(rel.targetRequirementId)) {
        continue
      }
      edges.push({
        kind: 'relationship',
        id: rel.id,
        fromId: rel.sourceRequirementId,
        toId: rel.targetRequirementId,
        type: rel.type,
        relationship: rel,
      })
    }

    const filteredEdges =
      focusKind === 'source'
        ? edges.filter((edge) =>
            edge.kind === 'source-link'
              ? visibleReqIds.has(edge.fromId)
              : visibleReqIds.has(edge.fromId) && visibleReqIds.has(edge.toId),
          )
        : edges.filter(
            (edge) =>
              edge.kind === 'relationship' &&
              visibleReqIds.has(edge.fromId) &&
              visibleReqIds.has(edge.toId),
          )

    const nodes: GraphNode[] = [
      ...(focusKind === 'source' ? [{ id: focusId, kind: 'source' as const }] : []),
      ...requirementIds.map((id) => ({ id, kind: 'requirement' as const })),
    ]

    return { nodes, edges: filteredEdges, focusNodeId }
  }, [focusId, focusKind, graphDepth, graphTypes, project, sourceLinkTypes, statusFilter, tagFilter])

  useEffect(() => {
    const width = 900
    const height = 560
    const cx = width / 2
    const cy = height / 2
    const initial: Record<string, NodePos> = {}
    neighborhood.nodes.forEach((node, index) => {
      const angle = (index / Math.max(neighborhood.nodes.length, 1)) * Math.PI * 2
      const radius = node.id === neighborhood.focusNodeId ? 0 : 140 + (index % 5) * 28
      initial[node.id] = {
        id: node.id,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      }
    })
    setPositions(initial)
  }, [neighborhood.nodes, neighborhood.focusNodeId])

  useEffect(() => {
    const ids = neighborhood.nodes.map((node) => node.id)
    if (ids.length === 0) return
    const focusNodeId = neighborhood.focusNodeId

    let frames = 0
    const step = () => {
      frames += 1
      setPositions((prev) => {
        const next: Record<string, NodePos> = {}
        for (const id of ids) {
          const p = prev[id]
          if (!p) continue
          next[id] = { ...p }
        }
        for (let i = 0; i < ids.length; i += 1) {
          for (let j = i + 1; j < ids.length; j += 1) {
            const a = next[ids[i]]
            const b = next[ids[j]]
            if (!a || !b) continue
            let dx = a.x - b.x
            let dy = a.y - b.y
            let dist = Math.sqrt(dx * dx + dy * dy) || 0.01
            const force = 4000 / (dist * dist)
            dx = (dx / dist) * force
            dy = (dy / dist) * force
            a.vx += dx
            a.vy += dy
            b.vx -= dx
            b.vy -= dy
          }
        }
        for (const edge of neighborhood.edges) {
          const a = next[edge.fromId]
          const b = next[edge.toId]
          if (!a || !b) continue
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
          const force = (dist - 160) * 0.02
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          a.vx += fx
          a.vy += fy
          b.vx -= fx
          b.vy -= fy
        }
        for (const id of ids) {
          const p = next[id]
          if (!p) continue
          const focused = id === focusNodeId
          p.vx += (450 - p.x) * (focused ? 0.05 : 0.005)
          p.vy += (280 - p.y) * (focused ? 0.05 : 0.005)
          p.vx *= 0.8
          p.vy *= 0.8
          p.x += p.vx
          p.y += p.vy
          p.x = Math.max(40, Math.min(860, p.x))
          p.y = Math.max(40, Math.min(520, p.y))
        }
        return next
      })
      if (frames < 120) frameRef.current = requestAnimationFrame(step)
    }
    frameRef.current = requestAnimationFrame(step)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [neighborhood.nodes, neighborhood.edges, neighborhood.focusNodeId])

  const selectedEdgeObj = selectedEdge
    ? neighborhood.edges.find((edge) => edge.id === selectedEdge) || null
    : null
  const graphNodesById = useMemo(
    () => new Map(neighborhood.nodes.map((node) => [node.id, node])),
    [neighborhood.nodes],
  )

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
      <div>
        <h2 className="page-title">Relationship Graph</h2>
        <p className="page-subtitle">
          {focusKind === 'source'
            ? 'Focused neighborhood around a selected source and its linked requirements.'
            : 'Focused neighborhood around a selected requirement. Full-project graphs are intentionally avoided.'}
        </p>
      </div>

      <div className="grid gap-3 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="space-y-3">
          <section className="panel space-y-3 p-3">
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
          </section>

          <section className="panel space-y-3 p-3">
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
          </section>

          {focusKind === 'source' && (
            <section className="panel p-3">
              <div className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-[var(--color-ink-muted)]">
                Source links
              </div>
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
            </section>
          )}

          <section className="panel p-3">
            <div className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-[var(--color-ink-muted)]">
              Requirement relationships
            </div>
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
          </section>

          <section className="panel p-3 text-sm">
            <h3 className="mb-2 font-semibold">
              {focusKind === 'source' ? 'Selected source' : 'Selected requirement'}
            </h3>
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
          </section>

          <section className="panel p-3 text-sm">
            <h3 className="mb-2 font-semibold">Selected relationship</h3>
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
            <svg
              ref={graphSvgRef}
              viewBox="0 0 900 560"
              className="h-[min(70vh,560px)] w-full bg-[linear-gradient(180deg,#f8fafc,#eef3f8)] xl:h-[min(75vh,640px)]"
            >
              <defs>
                <marker
                  id="arrow"
                  markerWidth="10"
                  markerHeight="10"
                  refX="8"
                  refY="4"
                  orient="auto"
                  markerUnits="userSpaceOnUse"
                >
                  <path d="M0,0 L8,4 L0,8 Z" fill="#1f5f8b" />
                </marker>
                <marker
                  id="arrow-source"
                  markerWidth="10"
                  markerHeight="10"
                  refX="8"
                  refY="4"
                  orient="auto"
                  markerUnits="userSpaceOnUse"
                >
                  <path d="M0,0 L8,4 L0,8 Z" fill="#9a6b2f" />
                </marker>
                <marker
                  id="arrow-selected"
                  markerWidth="10"
                  markerHeight="10"
                  refX="8"
                  refY="4"
                  orient="auto"
                  markerUnits="userSpaceOnUse"
                >
                  <path d="M0,0 L8,4 L0,8 Z" fill="#7a3e00" />
                </marker>
              </defs>
              {neighborhood.edges.map((edge) => {
                const arrowFromId =
                  edge.kind === 'relationship' && edge.type === 'Child of'
                    ? edge.toId
                    : edge.fromId
                const arrowToId =
                  edge.kind === 'relationship' && edge.type === 'Child of'
                    ? edge.fromId
                    : edge.toId
                const arrowFrom = positions[arrowFromId]
                const arrowTo = positions[arrowToId]
                const fromNode = graphNodesById.get(arrowFromId)
                const toNode = graphNodesById.get(arrowToId)
                if (!arrowFrom || !arrowTo || !fromNode || !toNode) return null
                const start = boundaryPoint(
                  fromNode,
                  arrowFrom,
                  arrowTo,
                  arrowFromId === neighborhood.focusNodeId,
                )
                const end = boundaryPoint(
                  toNode,
                  arrowTo,
                  arrowFrom,
                  arrowToId === neighborhood.focusNodeId,
                )
                const isSourceLink = edge.kind === 'source-link'
                const selected = selectedEdge === edge.id
                return (
                  <g key={edge.id}>
                    <line
                      x1={start.x}
                      y1={start.y}
                      x2={end.x}
                      y2={end.y}
                      stroke={selected ? '#7a3e00' : isSourceLink ? '#9a6b2f' : '#1f5f8b'}
                      strokeWidth={selected ? 2.5 : 1.5}
                      strokeDasharray={isSourceLink ? '5 4' : undefined}
                      markerEnd={
                        selected
                          ? 'url(#arrow-selected)'
                          : isSourceLink
                            ? 'url(#arrow-source)'
                            : 'url(#arrow)'
                      }
                      className="cursor-pointer"
                      onClick={() => setSelectedEdge(edge.id)}
                    />
                    <text
                      x={(arrowFrom.x + arrowTo.x) / 2}
                      y={(arrowFrom.y + arrowTo.y) / 2 - 6}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#4a5568"
                    >
                      {edge.kind === 'relationship' && edge.type === 'Child of'
                        ? 'Parent of'
                        : edge.type}
                    </text>
                  </g>
                )
              })}
              {neighborhood.nodes.map((node) => {
                const p = positions[node.id]
                if (!p) return null
                const focused = node.id === neighborhood.focusNodeId

                if (node.kind === 'source') {
                  const source = sources.find((item) => item.id === node.id)
                  if (!source) return null
                  const label = source.identifier || source.title
                  return (
                    <g
                      key={node.id}
                      className="cursor-pointer"
                      onMouseEnter={clearRequirementHover}
                      onClick={() => setGraphSourceFocus(node.id)}
                      onDoubleClick={() => {
                        window.location.hash = `#/sources/${node.id}`
                      }}
                    >
                      <rect
                        x={p.x - 36}
                        y={p.y - 22}
                        width={72}
                        height={44}
                        rx={4}
                        fill={focused ? '#7a3e00' : '#ffffff'}
                        stroke={focused ? '#5c2e00' : '#7a3e00'}
                        strokeWidth="2"
                      />
                      <text
                        x={p.x}
                        y={p.y + 4}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="700"
                        fill={focused ? '#ffffff' : '#1a2332'}
                      >
                        {label.length > 9 ? `${label.slice(0, 9)}…` : label}
                      </text>
                    </g>
                  )
                }

                const req = project.requirements.find((r) => r.id === node.id)
                if (!req) return null
                return (
                  <g
                    key={node.id}
                    className="cursor-pointer"
                    onMouseEnter={() => showRequirementHover(node.id)}
                    onMouseLeave={() => scheduleRequirementHoverClear(450)}
                    onClick={() => setGraphFocus(node.id)}
                    onDoubleClick={() => {
                      window.location.hash = `#/requirements/${node.id}`
                    }}
                  >
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={focused ? 28 : 22}
                      fill={focused ? '#1f5f8b' : '#ffffff'}
                      stroke={focused ? '#174a6c' : '#1f5f8b'}
                      strokeWidth="2"
                    />
                    <text
                      x={p.x}
                      y={p.y + 4}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="700"
                      fill={focused ? '#ffffff' : '#1a2332'}
                    >
                      {req.sourceId.length > 8 ? `${req.sourceId.slice(0, 8)}…` : req.sourceId}
                    </text>
                  </g>
                )
              })}
            </svg>
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
