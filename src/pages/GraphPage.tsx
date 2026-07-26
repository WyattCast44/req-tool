import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore'
import { RELATIONSHIP_TYPES, RECIPROCAL_RELATIONSHIP } from '../types/project'
import { lookupLabel } from '../lib/defaults'

interface NodePos {
  id: string
  x: number
  y: number
  vx: number
  vy: number
}

export function GraphPage() {
  const project = useProjectStore((s) => s.project)!
  const graphFocusId = useProjectStore((s) => s.graphFocusId)
  const setGraphFocus = useProjectStore((s) => s.setGraphFocus)
  const graphDepth = useProjectStore((s) => s.graphDepth)
  const setGraphDepth = useProjectStore((s) => s.setGraphDepth)
  const graphTypes = useProjectStore((s) => s.graphTypes)
  const setGraphTypes = useProjectStore((s) => s.setGraphTypes)

  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [positions, setPositions] = useState<Record<string, NodePos>>({})
  const frameRef = useRef<number | null>(null)

  const focusId = graphFocusId || project.requirements[0]?.id || null

  const neighborhood = useMemo(() => {
    if (!focusId) return { nodes: [] as string[], edges: [] as typeof project.relationships }
    const allowed = new Set(graphTypes)
    const nodeSet = new Set<string>([focusId])
    let frontier = [focusId]
    for (let depth = 0; depth < graphDepth; depth += 1) {
      const next: string[] = []
      for (const id of frontier) {
        for (const rel of project.relationships) {
          if (!allowed.has(rel.type)) continue
          let other: string | null = null
          if (rel.sourceRequirementId === id) other = rel.targetRequirementId
          else if (rel.targetRequirementId === id) other = rel.sourceRequirementId
          if (other && !nodeSet.has(other)) {
            nodeSet.add(other)
            next.push(other)
          }
        }
      }
      frontier = next
    }

    let nodes = Array.from(nodeSet)
    if (statusFilter.length) {
      nodes = nodes.filter((id) => {
        const req = project.requirements.find((r) => r.id === id)
        return req && statusFilter.includes(req.statusId)
      })
      if (!nodes.includes(focusId)) nodes = [focusId, ...nodes]
    }
    if (tagFilter.length) {
      nodes = nodes.filter((id) => {
        const req = project.requirements.find((r) => r.id === id)
        return req && tagFilter.some((t) => req.tagIds.includes(t))
      })
      if (!nodes.includes(focusId)) nodes = [focusId, ...nodes]
    }
    const nodeIds = new Set(nodes)
    const edges = project.relationships.filter(
      (r) =>
        allowed.has(r.type) &&
        nodeIds.has(r.sourceRequirementId) &&
        nodeIds.has(r.targetRequirementId),
    )
    return { nodes, edges }
  }, [focusId, graphDepth, graphTypes, project, statusFilter, tagFilter])

  useEffect(() => {
    const width = 900
    const height = 560
    const cx = width / 2
    const cy = height / 2
    const initial: Record<string, NodePos> = {}
    neighborhood.nodes.forEach((id, index) => {
      const angle = (index / Math.max(neighborhood.nodes.length, 1)) * Math.PI * 2
      const radius = id === focusId ? 0 : 140 + (index % 5) * 28
      initial[id] = {
        id,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      }
    })
    setPositions(initial)
  }, [neighborhood.nodes, focusId])

  useEffect(() => {
    const ids = neighborhood.nodes
    if (ids.length === 0) return

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
        // repulsion
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
        // springs
        for (const edge of neighborhood.edges) {
          const a = next[edge.sourceRequirementId]
          const b = next[edge.targetRequirementId]
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
        // center focus
        for (const id of ids) {
          const p = next[id]
          if (!p) continue
          const tx = id === focusId ? 450 : 450
          const ty = id === focusId ? 280 : 280
          p.vx += (tx - p.x) * (id === focusId ? 0.05 : 0.005)
          p.vy += (ty - p.y) * (id === focusId ? 0.05 : 0.005)
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
  }, [neighborhood.nodes, neighborhood.edges, focusId])

  const selectedRel = selectedEdge
    ? project.relationships.find((r) => r.id === selectedEdge)
    : null

  return (
    <div className="space-y-2.5">
      <div>
        <h2 className="page-title">Relationship Graph</h2>
          <p className="page-subtitle">
            Focused neighborhood around a selected requirement. Full-project graphs are intentionally avoided.
          </p>
      </div>

      <div className="panel grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="block">
          <span className="field-label">Center requirement</span>
          <select
            className="field-input"
            value={focusId || ''}
            onChange={(e) => setGraphFocus(e.target.value || null)}
          >
            {project.requirements.map((r) => (
              <option key={r.id} value={r.id}>
                {r.sourceId} — {r.shortTitle || 'Untitled'}
              </option>
            ))}
          </select>
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
        <label className="block">
          <span className="field-label">Status filter</span>
          <select
            multiple
            className="field-input min-h-[5rem]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(Array.from(e.target.selectedOptions).map((o) => o.value))}
          >
            {project.lookups.statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.value}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Tag filter</span>
          <select
            multiple
            className="field-input min-h-[5rem]"
            value={tagFilter}
            onChange={(e) => setTagFilter(Array.from(e.target.selectedOptions).map((o) => o.value))}
          >
            {project.tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="panel flex flex-wrap gap-3 p-3">
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

      <div className="panel overflow-hidden p-2">
        <svg viewBox="0 0 900 560" className="h-[560px] w-full bg-[linear-gradient(180deg,#f8fafc,#eef3f8)]">
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#1f5f8b" />
            </marker>
          </defs>
          {neighborhood.edges.map((edge) => {
            const a = positions[edge.sourceRequirementId]
            const b = positions[edge.targetRequirementId]
            if (!a || !b) return null
            return (
              <g key={edge.id}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={selectedEdge === edge.id ? '#7a3e00' : '#1f5f8b'}
                  strokeWidth={selectedEdge === edge.id ? 2.5 : 1.5}
                  markerEnd="url(#arrow)"
                  className="cursor-pointer"
                  onClick={() => setSelectedEdge(edge.id)}
                />
                <text
                  x={(a.x + b.x) / 2}
                  y={(a.y + b.y) / 2 - 6}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#4a5568"
                >
                  {edge.type}
                </text>
              </g>
            )
          })}
          {neighborhood.nodes.map((id) => {
            const p = positions[id]
            const req = project.requirements.find((r) => r.id === id)
            if (!p || !req) return null
            const focused = id === focusId
            return (
              <g
                key={id}
                className="cursor-pointer"
                onClick={() => setGraphFocus(id)}
                onDoubleClick={() => {
                  window.location.hash = `#/requirements/${id}`
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
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel p-4 text-sm">
          <h3 className="mb-2 font-semibold">Selected requirement</h3>
          {focusId ? (
            (() => {
              const req = project.requirements.find((r) => r.id === focusId)!
              return (
                <div className="space-y-1">
                  <div className="font-semibold">{req.sourceId} — {req.shortTitle || 'Untitled'}</div>
                  <div>Status: {lookupLabel(project.lookups.statuses, req.statusId)}</div>
                  <Link className="btn btn-secondary mt-2 inline-flex" to={`/requirements/${req.id}`}>
                    Open detail
                  </Link>
                </div>
              )
            })()
          ) : (
            <p>No requirement selected.</p>
          )}
        </div>
        <div className="panel p-4 text-sm">
          <h3 className="mb-2 font-semibold">Selected relationship</h3>
          {selectedRel ? (
            <div className="space-y-1">
              <div>
                {project.requirements.find((r) => r.id === selectedRel.sourceRequirementId)?.sourceId} →{' '}
                {project.requirements.find((r) => r.id === selectedRel.targetRequirementId)?.sourceId}
              </div>
              <div>
                Type: {selectedRel.type}
                {RECIPROCAL_RELATIONSHIP[selectedRel.type]
                  ? ` (reciprocal display: ${RECIPROCAL_RELATIONSHIP[selectedRel.type]})`
                  : ''}
              </div>
              <div>Rationale: {selectedRel.rationale || '—'}</div>
              <div>Notes: {selectedRel.notes || '—'}</div>
            </div>
          ) : (
            <p className="text-[var(--color-ink-muted)]">Click an edge to inspect rationale.</p>
          )}
        </div>
      </div>
    </div>
  )
}
