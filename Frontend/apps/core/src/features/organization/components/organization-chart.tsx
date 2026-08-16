"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dagre from "dagre";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type OnNodeDrag,
} from "@xyflow/react";
import { ChevronDown, ChevronRight, GripVertical, Plus } from "lucide-react";
import { Button, cn } from "@repo/ds";
import type { OrganizationHierarchyModel } from "../model/hierarchy";
import { isInvalidMoveTarget, organizationAccessibleName } from "../model/hierarchy";

const NODE_WIDTH = 244;
const NODE_HEIGHT = 78;

type OrganizationNodeData = Record<string, unknown> & {
  id: string;
  name: string;
  typeName: string;
  code: string;
  accessibleName: string;
  root: boolean;
  selected: boolean;
  collapsed: boolean;
  hasChildren: boolean;
  hiddenCount: number;
  canManage: boolean;
  readOnly: boolean;
  moving: boolean;
  validDrop: boolean;
  invalidDrop: boolean;
  revealed: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onAddChild: (id: string) => void;
};

type OrganizationFlowNode = Node<OrganizationNodeData, "organizationUnit">;

const hiddenHandle =
  "!pointer-events-none !h-1.5 !w-1.5 !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0";

const OrganizationNode = memo(function OrganizationNode({ data }: NodeProps<OrganizationFlowNode>) {
  return (
    <div
      className={cn(
        // React Flow sets pointer-events:none on non-draggable nodes (root, and
        // every node in read-only as-of views); re-enable so the card stays
        // selectable/inspectable and its disclosure stays operable.
        "group pointer-events-auto relative h-[78px] w-[244px] rounded-lg border bg-card shadow-[0_1px_2px_oklch(0_0_0/0.05)] transition-[border-color,box-shadow,opacity,background-color] duration-500 motion-reduce:transition-none",
        data.root && "border-l-[3px] border-l-primary/60 bg-[color-mix(in_oklab,var(--primary)_4%,var(--card))]",
        !data.selected && !data.validDrop && !data.invalidDrop && "hover:border-foreground/25 hover:shadow-md",
        data.selected && "border-primary shadow-md ring-2 ring-primary/25",
        data.revealed && "org-reveal-highlight z-10",
        data.moving && "opacity-55 ring-2 ring-primary/40",
        data.validDrop && "border-primary bg-[color-mix(in_oklab,var(--primary)_7%,var(--card))] ring-2 ring-primary/35",
        data.invalidDrop && "border-destructive bg-[color-mix(in_oklab,var(--destructive)_6%,var(--card))] ring-2 ring-destructive/25"
      )}
    >
      <Handle type="target" position={Position.Top} className={hiddenHandle} />
      <button
        type="button"
        aria-label={data.accessibleName}
        aria-pressed={data.selected}
        onClick={() => data.onSelect(data.id)}
        className="flex h-full w-full flex-col justify-center gap-1 rounded-lg px-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      >
        <span className="truncate pr-14 text-sm font-semibold leading-tight text-foreground">
          {data.name}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 pr-2 text-xs text-muted-foreground">
          <span className="truncate">{data.typeName}</span>
          <span aria-hidden className="text-muted-foreground/50">·</span>
          <span className="shrink-0 font-mono text-[11px] uppercase tracking-wide">{data.code}</span>
        </span>
      </button>
      {data.hasChildren ? (
        <button
          type="button"
          aria-label={`${data.collapsed ? `Expand ${data.name}, ${data.hiddenCount} hidden unit${data.hiddenCount === 1 ? "" : "s"}` : `Collapse ${data.name}`}`}
          aria-expanded={!data.collapsed}
          onClick={(event) => { event.stopPropagation(); data.onToggle(data.id); }}
          className={cn(
            "absolute -bottom-3 left-1/2 flex h-6 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
            data.collapsed ? "gap-0.5 px-1.5" : "w-6"
          )}
        >
          {data.collapsed ? (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-[11px] font-semibold tabular-nums">{data.hiddenCount}</span>
            </>
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      ) : null}
      {data.canManage && !data.readOnly ? (
        <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-md border bg-background/95 p-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Button type="button" variant="ghost" size="icon-sm" className="h-6 w-6" aria-label={`Add child to ${data.name}`} onClick={(event) => { event.stopPropagation(); data.onAddChild(data.id); }}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
          {!data.root ? (
            <span
              className="org-drag-handle grid h-6 w-6 cursor-grab place-items-center rounded text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
              role="button"
              aria-label={`Drag to move ${data.name}`}
              title="Drag to move"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </div>
      ) : null}
      <Handle type="source" position={Position.Bottom} className={hiddenHandle} />
    </div>
  );
});

const nodeTypes = { organizationUnit: OrganizationNode };

function reduceMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function FocusSelected({ selectedId }: { selectedId: string | null }) {
  const flow = useReactFlow<OrganizationFlowNode, Edge>();
  useEffect(() => {
    if (!selectedId) return;
    const node = flow.getNode(selectedId);
    if (!node) return;
    void flow.setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + NODE_HEIGHT / 2, {
      zoom: flow.getZoom(),
      duration: reduceMotion() ? 0 : 180,
    });
  }, [flow, selectedId]);
  return null;
}

// Keep the interacted node spatially anchored across an expand/collapse relayout.
// dagre re-lays-out every visible node, so without compensation the toggled node
// jumps; here the viewport is translated by the node's position delta (preserving
// zoom) so it stays put on screen. Runs synchronously before paint.
function AnchorViewport({
  nodes,
  pendingAnchorRef,
}: {
  nodes: OrganizationFlowNode[];
  pendingAnchorRef: React.MutableRefObject<{ id: string; x: number; y: number } | null>;
}) {
  const flow = useReactFlow<OrganizationFlowNode, Edge>();
  useLayoutEffect(() => {
    const anchor = pendingAnchorRef.current;
    if (!anchor) return;
    pendingAnchorRef.current = null;
    const next = nodes.find((node) => node.id === anchor.id);
    if (!next) return;
    const viewport = flow.getViewport();
    const dx = (anchor.x - next.position.x) * viewport.zoom;
    const dy = (anchor.y - next.position.y) * viewport.zoom;
    if (dx === 0 && dy === 0) return;
    void flow.setViewport({ x: viewport.x + dx, y: viewport.y + dy, zoom: viewport.zoom });
  }, [flow, nodes, pendingAnchorRef]);
  return null;
}

// A genuine reveal is allowed to move the viewport: bring the just-changed unit(s)
// into view — center a single node, or fit a created set — without disturbing
// pan/zoom on ordinary interactions.
function RevealViewport({
  revealedIds,
  nodes,
}: {
  revealedIds: ReadonlySet<string>;
  nodes: OrganizationFlowNode[];
}) {
  const flow = useReactFlow<OrganizationFlowNode, Edge>();
  const revealKey = useMemo(() => [...revealedIds].sort().join(","), [revealedIds]);
  useEffect(() => {
    if (revealKey === "") return;
    const ids = revealKey.split(",");
    const present = ids.filter((id) => nodes.some((node) => node.id === id));
    if (present.length === 0) return;
    const duration = reduceMotion() ? 0 : 420;
    if (present.length === 1) {
      const node = nodes.find((candidate) => candidate.id === present[0])!;
      void flow.setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + NODE_HEIGHT / 2, {
        zoom: Math.min(flow.getZoom(), 1),
        duration,
      });
    } else {
      void flow.fitView({
        nodes: present.map((id) => ({ id })),
        padding: 0.25,
        maxZoom: 1,
        duration,
      });
    }
    // Center once per revealed set; the highlight fade is owned by the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow, revealKey]);
  return null;
}

export interface OrganizationChartProps {
  model: OrganizationHierarchyModel;
  collapsed: ReadonlySet<string>;
  selectedId: string | null;
  revealedIds?: ReadonlySet<string>;
  canManage: boolean;
  readOnly: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onAddChild: (id: string) => void;
  onStageDragMove: (sourceId: string, targetId: string) => void;
}

const EMPTY_IDS: ReadonlySet<string> = new Set();

export default function OrganizationChart({
  model,
  collapsed,
  selectedId,
  revealedIds = EMPTY_IDS,
  canManage,
  readOnly,
  onSelect,
  onToggle,
  onAddChild,
  onStageDragMove,
}: OrganizationChartProps) {
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  // Keep the node the user toggled visually anchored: capture its pre-relayout
  // position, and after dagre repositions everything, compensate the viewport so
  // it does not jump across the screen. See AnchorViewport.
  const nodesRef = useRef<OrganizationFlowNode[]>([]);
  const pendingAnchorRef = useRef<{ id: string; x: number; y: number } | null>(null);

  const handleToggle = useCallback(
    (id: string) => {
      const current = nodesRef.current.find((node) => node.id === id);
      if (current) pendingAnchorRef.current = { id, x: current.position.x, y: current.position.y };
      onToggle(id);
    },
    [onToggle]
  );

  const dropValid =
    dragSource !== null &&
    dropTarget !== null &&
    !isInvalidMoveTarget(model, dragSource, dropTarget);

  const { nodes, edges } = useMemo(() => {
    const movingSet = dragSource
      ? new Set<string>([dragSource, ...(model.descendantsById.get(dragSource) ?? [])])
      : null;
    const visibleIds: string[] = [];
    const visibleEdges: Array<{ source: string; target: string }> = [];
    const visit = (id: string) => {
      visibleIds.push(id);
      if (collapsed.has(id)) return;
      for (const child of model.childrenByParent.get(id) ?? []) {
        visibleEdges.push({ source: id, target: child });
        visit(child);
      }
    };
    for (const root of model.roots) visit(root);

    const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    graph.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 62, marginx: 40, marginy: 40 });
    for (const id of visibleIds) graph.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    for (const edge of visibleEdges) graph.setEdge(edge.source, edge.target);
    dagre.layout(graph);

    return {
      nodes: visibleIds.map<OrganizationFlowNode>((id) => {
        const unit = model.byId.get(id)!;
        const position = graph.node(id) ?? { x: 0, y: 0 };
        const isCandidate = dropTarget === id && dragSource !== null && dragSource !== id;
        return {
          id,
          type: "organizationUnit",
          position: { x: position.x - NODE_WIDTH / 2, y: position.y - NODE_HEIGHT / 2 },
          draggable: canManage && !readOnly && unit.parentId !== null,
          dragHandle: ".org-drag-handle",
          data: {
            id,
            name: unit.name,
            typeName: unit.typeName,
            code: unit.code,
            accessibleName: organizationAccessibleName(model, id),
            root: unit.parentId === null,
            selected: selectedId === id,
            collapsed: collapsed.has(id),
            hasChildren: (model.childrenByParent.get(id)?.length ?? 0) > 0,
            hiddenCount: collapsed.has(id) ? (model.descendantsById.get(id)?.size ?? 0) : 0,
            canManage,
            readOnly,
            moving: movingSet?.has(id) === true && dropTarget !== id,
            validDrop: isCandidate && !isInvalidMoveTarget(model, dragSource!, id),
            invalidDrop: isCandidate && isInvalidMoveTarget(model, dragSource!, id),
            revealed: revealedIds.has(id),
            onSelect,
            onToggle: handleToggle,
            onAddChild,
          },
        };
      }),
      edges: visibleEdges.map<Edge>((edge) => ({
        id: `${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        style: {
          stroke: "var(--border)",
          strokeWidth: selectedId && (edge.source === selectedId || edge.target === selectedId) ? 2 : 1.25,
          opacity: dragSource && movingSet?.has(edge.target) ? 0.4 : 1,
        },
      })),
    };
  }, [canManage, collapsed, dragSource, dropTarget, handleToggle, model, onAddChild, onSelect, readOnly, revealedIds, selectedId]);

  nodesRef.current = nodes;

  const findDropTarget: OnNodeDrag<OrganizationFlowNode> = (_event, dragged) => {
    // Trigger as soon as the dragged card overlaps a target card (not only when
    // its center reaches the target); pick the most-overlapped node.
    const ax1 = dragged.position.x;
    const ay1 = dragged.position.y;
    const ax2 = ax1 + NODE_WIDTH;
    const ay2 = ay1 + NODE_HEIGHT;
    let candidate: string | null = null;
    let bestOverlap = 0;
    for (const node of nodes) {
      if (node.id === dragged.id) continue;
      const overlapX = Math.max(0, Math.min(ax2, node.position.x + NODE_WIDTH) - Math.max(ax1, node.position.x));
      const overlapY = Math.max(0, Math.min(ay2, node.position.y + NODE_HEIGHT) - Math.max(ay1, node.position.y));
      const overlap = overlapX * overlapY;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        candidate = node.id;
      }
    }
    setDropTarget(candidate);
  };

  const handleDragStop: OnNodeDrag<OrganizationFlowNode> = (_event, dragged) => {
    if (dropTarget && dropTarget !== dragged.id && !isInvalidMoveTarget(model, dragged.id, dropTarget)) {
      onStageDragMove(dragged.id, dropTarget);
    }
    setDragSource(null);
    setDropTarget(null);
  };

  const draggedUnit = dragSource ? model.byId.get(dragSource) : null;
  const draggedCount = dragSource ? (model.descendantsById.get(dragSource)?.size ?? 0) : 0;

  return (
    <div className="relative h-full min-h-[520px] overflow-hidden bg-muted/10">
      {draggedUnit ? (
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-background/95 px-3.5 py-1.5 text-xs shadow-sm">
          <span
            className={cn(
              "inline-block h-1.5 w-1.5 rounded-full",
              dropTarget ? (dropValid ? "bg-primary" : "bg-destructive") : "bg-muted-foreground"
            )}
          />
          <span className="font-medium">
            {draggedCount > 0
              ? `Moving ${draggedUnit.name} + ${draggedCount} unit${draggedCount === 1 ? "" : "s"}`
              : `Moving ${draggedUnit.name}`}
          </span>
          <span className="text-muted-foreground">
            {dropTarget
              ? dropValid
                ? "Drop to review"
                : "Can't drop here"
              : "Drop onto a new parent"}
          </span>
        </div>
      ) : null}
      <ReactFlow<OrganizationFlowNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.25}
        maxZoom={1.5}
        nodesConnectable={false}
        elementsSelectable={false}
        nodeDragThreshold={8}
        onlyRenderVisibleElements
        onNodeDragStart={(_event, node) => setDragSource(node.id)}
        onNodeDrag={findDropTarget}
        onNodeDragStop={handleDragStop}
        proOptions={{ hideAttribution: true }}
        className="bg-transparent"
      >
        <FocusSelected selectedId={selectedId} />
        <AnchorViewport nodes={nodes} pendingAnchorRef={pendingAnchorRef} />
        <RevealViewport revealedIds={revealedIds} nodes={nodes} />
        {/* Fine single grid that rides the viewport transform, so panning and
            zooming read as movement through space. */}
        <Background
          variant={BackgroundVariant.Lines}
          gap={16}
          lineWidth={1}
          color="color-mix(in oklab, var(--border) 50%, transparent)"
        />
        <Controls position="bottom-right" showInteractive={false} />
        {nodes.length > 30 ? (
          <MiniMap
            ariaLabel="Organization chart overview"
            pannable
            zoomable
            className="!bottom-3 !right-14 !rounded-lg !border !border-border !bg-background/95 !shadow-sm"
            maskColor="color-mix(in oklab, var(--muted) 66%, transparent)"
            nodeColor="var(--muted-foreground)"
          />
        ) : null}
      </ReactFlow>
    </div>
  );
}
