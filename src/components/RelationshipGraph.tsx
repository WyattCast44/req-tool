import cytoscape, {
  type Core,
  type EventObject,
  type LayoutOptions,
  type NodeSingular,
  type StylesheetJson,
} from 'cytoscape'
import { useEffect, useMemo, useRef } from 'react'
import {
  graphElementDefinitions,
  type GraphNeighborhood,
  type GraphNode,
} from '../lib/relationshipGraph'

interface ClientPoint {
  x: number
  y: number
}

interface RelationshipGraphProps {
  neighborhood: GraphNeighborhood
  selectedEdgeId: string | null
  onSelectNode: (node: GraphNode) => void
  onOpenNode: (node: GraphNode) => void
  onSelectEdge: (edgeId: string) => void
  onRequirementHover: (requirementId: string, point: ClientPoint) => void
  onRequirementMove: (point: ClientPoint) => void
  onRequirementLeave: () => void
}

const graphStyles: StylesheetJson = [
  {
    selector: 'node',
    style: {
      'background-color': '#ffffff',
      'border-color': '#1f5f8b',
      'border-width': 2,
      color: '#1a2332',
      label: 'data(label)',
      'font-size': 10,
      'font-weight': 700,
      height: 44,
      width: 44,
      'min-zoomed-font-size': 8,
      'text-halign': 'center',
      'text-valign': 'center',
      'text-max-width': '64px',
      'text-wrap': 'ellipsis',
    },
  },
  {
    selector: 'node.source',
    style: {
      shape: 'round-rectangle',
      height: 44,
      width: 72,
      'border-color': '#7a3e00',
    },
  },
  {
    selector: 'node.focused',
    style: {
      'background-color': '#1f5f8b',
      'border-color': '#174a6c',
      color: '#ffffff',
      height: 56,
      width: 56,
    },
  },
  {
    selector: 'node.source.focused',
    style: {
      'background-color': '#7a3e00',
      'border-color': '#5c2e00',
      height: 48,
      width: 80,
    },
  },
  {
    selector: 'edge',
    style: {
      'curve-style': 'straight',
      'line-color': '#1f5f8b',
      'target-arrow-color': '#1f5f8b',
      'target-arrow-shape': 'triangle',
      'arrow-scale': 0.85,
      width: 1.5,
      label: 'data(label)',
      color: '#4a5568',
      'font-size': 10,
      'min-zoomed-font-size': 8,
      'text-background-color': '#f4f7fa',
      'text-background-opacity': 0.82,
      'text-background-padding': '2px',
      'text-rotation': 'autorotate',
    },
  },
  {
    selector: 'edge.source-link',
    style: {
      'line-color': '#9a6b2f',
      'line-style': 'dashed',
      'target-arrow-color': '#9a6b2f',
    },
  },
  {
    selector: 'edge.selected',
    style: {
      'line-color': '#7a3e00',
      'target-arrow-color': '#7a3e00',
      width: 2.5,
      'z-index': 10,
    },
  },
  {
    selector: 'node:active',
    style: {
      'overlay-color': '#1f5f8b',
      'overlay-opacity': 0.12,
    },
  },
]

function clientPoint(container: HTMLDivElement, node: NodeSingular): ClientPoint {
  const containerRect = container.getBoundingClientRect()
  const point = node.renderedPosition()
  return {
    x: containerRect.left + point.x,
    y: containerRect.top + point.y,
  }
}

function graphLayout(_core: Core, neighborhood: GraphNeighborhood): LayoutOptions {
  if (neighborhood.focusKind === 'source') {
    return {
      name: 'concentric',
      animate: false,
      fit: true,
      padding: 45,
      minNodeSpacing: 24,
      concentric: (node) =>
        node.id() === neighborhood.focusNodeId ? 100_000 : node.degree(false),
      levelWidth: () => 2,
    }
  }

  if (neighborhood.nodes.length > 75) {
    return {
      name: 'breadthfirst',
      animate: false,
      directed: false,
      fit: true,
      padding: 45,
      roots: neighborhood.focusNodeId ? [neighborhood.focusNodeId] : undefined,
      spacingFactor: 1.15,
    }
  }

  return {
    name: 'cose',
    animate: true,
    animationDuration: 450,
    fit: true,
    padding: 45,
    randomize: true,
    nodeRepulsion: () => 5_000,
    idealEdgeLength: () => 100,
    edgeElasticity: () => 100,
    gravity: 0.4,
    numIter: 800,
  }
}

export function RelationshipGraph({
  neighborhood,
  selectedEdgeId,
  onSelectNode,
  onOpenNode,
  onSelectEdge,
  onRequirementHover,
  onRequirementMove,
  onRequirementLeave,
}: RelationshipGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const coreRef = useRef<Core | null>(null)
  const hoveredRequirementRef = useRef<string | null>(null)
  const lastTapRef = useRef<{ id: string; at: number } | null>(null)
  const callbacksRef = useRef({
    onSelectNode,
    onOpenNode,
    onSelectEdge,
    onRequirementHover,
    onRequirementMove,
    onRequirementLeave,
  })
  callbacksRef.current = {
    onSelectNode,
    onOpenNode,
    onSelectEdge,
    onRequirementHover,
    onRequirementMove,
    onRequirementLeave,
  }

  const nodesById = useMemo(
    () => new Map(neighborhood.nodes.map((node) => [node.id, node])),
    [neighborhood.nodes],
  )
  const elements = useMemo(
    () => graphElementDefinitions(neighborhood),
    [neighborhood],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const core = cytoscape({
      container,
      elements,
      style: graphStyles,
      minZoom: 0.08,
      maxZoom: 3,
      wheelSensitivity: 0.22,
      selectionType: 'single',
    })
    coreRef.current = core

    const updateHoveredPosition = () => {
      const requirementId = hoveredRequirementRef.current
      if (!requirementId) return
      const node = core.getElementById(requirementId)
      if (node.empty()) return
      callbacksRef.current.onRequirementMove(
        clientPoint(container, node.first() as NodeSingular),
      )
    }

    const handleNodeTap = (event: EventObject) => {
      const graphNode = nodesById.get(event.target.id())
      if (!graphNode) return
      callbacksRef.current.onSelectNode(graphNode)

      const now = Date.now()
      const lastTap = lastTapRef.current
      if (lastTap?.id === graphNode.id && now - lastTap.at <= 300) {
        lastTapRef.current = null
        callbacksRef.current.onOpenNode(graphNode)
      } else {
        lastTapRef.current = { id: graphNode.id, at: now }
      }
    }

    const handleEdgeTap = (event: EventObject) => {
      callbacksRef.current.onSelectEdge(event.target.id())
    }

    const handleNodeMouseOver = (event: EventObject) => {
      const graphNode = nodesById.get(event.target.id())
      if (!graphNode || graphNode.kind !== 'requirement') return
      hoveredRequirementRef.current = graphNode.id
      callbacksRef.current.onRequirementHover(
        graphNode.id,
        clientPoint(container, event.target as NodeSingular),
      )
    }

    const handleNodeMouseOut = (event: EventObject) => {
      if (hoveredRequirementRef.current !== event.target.id()) return
      hoveredRequirementRef.current = null
      callbacksRef.current.onRequirementLeave()
    }

    core.on('tap', 'node', handleNodeTap)
    core.on('tap', 'edge', handleEdgeTap)
    core.on('mouseover', 'node.requirement', handleNodeMouseOver)
    core.on('mouseout', 'node.requirement', handleNodeMouseOut)
    core.on('render', updateHoveredPosition)

    const resizeObserver = new ResizeObserver(() => {
      core.resize()
    })
    resizeObserver.observe(container)

    const layout = core.layout(graphLayout(core, neighborhood))
    layout.run()

    return () => {
      resizeObserver.disconnect()
      layout.stop()
      if (hoveredRequirementRef.current) {
        callbacksRef.current.onRequirementLeave()
      }
      hoveredRequirementRef.current = null
      core.destroy()
      coreRef.current = null
    }
  }, [elements, neighborhood, nodesById])

  useEffect(() => {
    const core = coreRef.current
    if (!core) return
    core.edges().removeClass('selected')
    if (selectedEdgeId) core.getElementById(selectedEdgeId).addClass('selected')
  }, [selectedEdgeId, elements])

  return (
    <div className="relative">
      <div
        ref={containerRef}
        role="img"
        aria-label={`Relationship graph with ${neighborhood.nodes.length} nodes and ${neighborhood.edges.length} edges`}
        className="h-[min(70vh,560px)] w-full bg-[linear-gradient(180deg,#f8fafc,#eef3f8)] xl:h-[min(75vh,640px)]"
      />
      <button
        type="button"
        className="btn btn-secondary absolute right-2 top-2 z-10 bg-white/95"
        onClick={() => coreRef.current?.fit(undefined, 45)}
      >
        Fit graph
      </button>
    </div>
  )
}
