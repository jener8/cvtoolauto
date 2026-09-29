"use client"

import { useMemo } from "react"
import type { StoryMap, StoryMapNode } from "@/lib/application-story-wizard/types"
import { cn } from "@/lib/utils"

const NODE_COLORS: Record<StoryMapNode["type"], string> = {
  company_goal: "#2563eb",
  challenge: "#dc2626",
  capability: "var(--color-primary-light)",
  evidence: "#7c3aed",
  outcome: "#ca8a04",
}

type StoryMapViewProps = {
  storyMap: StoryMap
  selectedNodeId?: string | null
  highlightedEvidenceIds?: string[]
  onSelectNode?: (nodeId: string) => void
  className?: string
}

function layoutPositions(
  nodes: StoryMapNode[],
  layout: StoryMap["layout"],
  width: number,
  height: number,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  const padding = 80
  const innerW = width - padding * 2
  const innerH = height - padding * 2

  const byType = (type: StoryMapNode["type"]) => nodes.filter((n) => n.type === type)

  if (layout === "journey" || layout === "flow") {
    const ordered =
      layout === "flow"
        ? [...byType("company_goal"), ...byType("challenge"), ...byType("capability"), ...byType("evidence"), ...byType("outcome")]
        : nodes
    const count = Math.max(ordered.length, 1)
    ordered.forEach((node, i) => {
      if (layout === "flow") {
        positions.set(node.id, {
          x: width / 2,
          y: padding + (innerH * i) / Math.max(count - 1, 1),
        })
      } else {
        positions.set(node.id, {
          x: padding + (innerW * i) / Math.max(count - 1, 1),
          y: height / 2,
        })
      }
    })
    nodes.forEach((node) => {
      if (!positions.has(node.id)) {
        positions.set(node.id, { x: width / 2, y: height / 2 })
      }
    })
    return positions
  }

  if (layout === "bridge") {
    const left = [...byType("company_goal"), ...byType("challenge")]
    const right = [...byType("capability"), ...byType("evidence"), ...byType("outcome")]
    left.forEach((node, i) => {
      positions.set(node.id, {
        x: padding + innerW * 0.2,
        y: padding + (innerH * i) / Math.max(left.length - 1, 1),
      })
    })
    right.forEach((node, i) => {
      positions.set(node.id, {
        x: padding + innerW * 0.8,
        y: padding + (innerH * i) / Math.max(right.length - 1, 1),
      })
    })
    nodes.forEach((node) => {
      if (!positions.has(node.id)) {
        positions.set(node.id, { x: width / 2, y: height / 2 })
      }
    })
    return positions
  }

  // ecosystem — radial
  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(innerW, innerH) / 2
  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1) - Math.PI / 2
    positions.set(node.id, {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    })
  })
  return positions
}

export function StoryMapView({
  storyMap,
  selectedNodeId,
  highlightedEvidenceIds = [],
  onSelectNode,
  className,
}: StoryMapViewProps) {
  const width = 900
  const height = 480

  const positions = useMemo(
    () => layoutPositions(storyMap.nodes, storyMap.layout, width, height),
    [storyMap.nodes, storyMap.layout],
  )

  const nodeById = useMemo(() => new Map(storyMap.nodes.map((n) => [n.id, n])), [storyMap.nodes])

  return (
    <div className={cn("story-map-view overflow-x-auto rounded-2xl border bg-white", className)}>
      <div className="flex items-center justify-between border-b px-4 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Story Map · {storyMap.layout}
        </p>
        <p className="text-xs text-muted-foreground">Click a node to see CV evidence</p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[640px]"
        role="img"
        aria-label="Application story map"
      >
        {storyMap.edges.map((edge) => {
          const from = positions.get(edge.from)
          const to = positions.get(edge.to)
          if (!from || !to) return null
          return (
            <g key={edge.id}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="#cbd5e1"
                strokeWidth={2}
                markerEnd="url(#arrow)"
              />
              {edge.label ? (
                <text
                  x={(from.x + to.x) / 2}
                  y={(from.y + to.y) / 2 - 6}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {edge.label}
                </text>
              ) : null}
            </g>
          )
        })}
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
          </marker>
        </defs>
        {storyMap.nodes.map((node) => {
          const pos = positions.get(node.id)
          if (!pos) return null
          const isSelected = selectedNodeId === node.id
          const hasHighlight = node.evidenceIds.some((id) => highlightedEvidenceIds.includes(id))
          const color = NODE_COLORS[node.type]
          return (
            <g
              key={node.id}
              className={onSelectNode ? "cursor-pointer" : undefined}
              onClick={() => onSelectNode?.(node.id)}
              role={onSelectNode ? "button" : undefined}
              tabIndex={onSelectNode ? 0 : undefined}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelectNode?.(node.id)
              }}
            >
              <rect
                x={pos.x - 72}
                y={pos.y - 28}
                width={144}
                height={56}
                rx={12}
                fill={isSelected || hasHighlight ? `${color}22` : "#f8fafc"}
                stroke={isSelected ? color : hasHighlight ? color : "#e2e8f0"}
                strokeWidth={isSelected ? 2.5 : 1.5}
              />
              <text
                x={pos.x}
                y={pos.y - 4}
                textAnchor="middle"
                className="fill-foreground text-[11px] font-semibold"
              >
                {node.label.length > 22 ? `${node.label.slice(0, 20)}…` : node.label}
              </text>
              <text
                x={pos.x}
                y={pos.y + 12}
                textAnchor="middle"
                className="fill-muted-foreground text-[9px] uppercase"
              >
                {node.type.replace("_", " ")}
              </text>
            </g>
          )
        })}
      </svg>
      {selectedNodeId && nodeById.get(selectedNodeId)?.description ? (
        <p className="border-t px-4 py-3 text-sm text-muted-foreground">
          {nodeById.get(selectedNodeId)?.description}
        </p>
      ) : null}
    </div>
  )
}
