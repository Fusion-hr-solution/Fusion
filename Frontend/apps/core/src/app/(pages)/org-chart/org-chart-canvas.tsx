"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type NodeTypes, type OnNodeDrag, type XYPosition } from "@xyflow/react";
import {
  createOrgChartFlow,
  type OrgChartFlowNode,
  ORG_CHART_NODE_WIDTH,
  ORG_CHART_NODE_HEIGHT,
} from "./org-chart-layout";
import { OrgChartNode } from "./org-chart-node";
import {
  OrgChartFlowFrame,
  type OrgChartCanvasApi,
} from "./org-chart-flow-frame";
import type { EmployeeOrgChartNodeDto } from "./org-chart.types";
import type { ManagerReassignProposal } from "./manager-reassign-dialog";

export type { OrgChartCanvasApi };

const nodeTypes = {
  employeeOrgChart: OrgChartNode,
} satisfies NodeTypes;

interface OrgChartCanvasProps {
  roots: EmployeeOrgChartNodeDto[];
  showJobTitle: boolean;
  isReassignMode: boolean;
  collapsedEmployeeIds: Set<string>;
  selectedEmployeeId: string | null;
  highlightedEmployeeId: string | null;
  onSelectEmployee: (employeeId: string) => void;
  onToggleCollapse: (employeeId: string) => void;
  focusEmployeeId: string | null;
  focusRequestKey: number;
  fitViewKey: string;
  isOverviewMode: boolean;
  onCanvasApiReady?: (api: OrgChartCanvasApi | null) => void;
  onReassignProposal?: (proposal: ManagerReassignProposal) => void;
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function getEmployeeLevel(node: OrgChartFlowNode): number {
  return node.data.employee.level;
}

function findDropTarget(
  nodes: OrgChartFlowNode[],
  draggedNode: OrgChartFlowNode
) {
  const draggedX = draggedNode.position.x;
  const draggedY = draggedNode.position.y;
  const currentManagerId = draggedNode.data.employee.managerId;

  return nodes.find((candidate) => {
    if (candidate.id === draggedNode.id || candidate.id === currentManagerId) {
      return false;
    }
    return rectsOverlap(
      draggedX,
      draggedY,
      ORG_CHART_NODE_WIDTH,
      ORG_CHART_NODE_HEIGHT,
      candidate.position.x,
      candidate.position.y,
      ORG_CHART_NODE_WIDTH,
      ORG_CHART_NODE_HEIGHT
    );
  });
}

export function OrgChartCanvas({
  roots,
  showJobTitle,
  isReassignMode,
  collapsedEmployeeIds,
  selectedEmployeeId,
  highlightedEmployeeId,
  onSelectEmployee,
  onToggleCollapse,
  focusEmployeeId,
  focusRequestKey,
  fitViewKey,
  isOverviewMode,
  onCanvasApiReady,
  onReassignProposal,
}: OrgChartCanvasProps) {
  const [dropTargetEmployeeId, setDropTargetEmployeeId] = useState<
    string | null
  >(null);
  const dragStartPositionRef = useRef<XYPosition | null>(null);

  const { nodes: layoutNodes, edges } = useMemo(
    () =>
      createOrgChartFlow({
        roots,
        collapsedEmployeeIds,
        selectedEmployeeId,
        highlightedEmployeeId,
        showJobTitle,
        isReassignMode,
        dropTargetEmployeeId,
        onSelectEmployee,
        onToggleCollapse,
      }),
    [
      collapsedEmployeeIds,
      dropTargetEmployeeId,
      highlightedEmployeeId,
      isReassignMode,
      onSelectEmployee,
      onToggleCollapse,
      roots,
      selectedEmployeeId,
      showJobTitle,
    ]
  );

  // Per-node draggable:false in the layout overrides the global flag, so lift it to
  // true when drag-to-reassign is enabled.
  const nodes = useMemo(
    () =>
      isReassignMode && onReassignProposal
        ? layoutNodes.map((n) => ({ ...n, draggable: true }))
        : layoutNodes,
    [isReassignMode, layoutNodes, onReassignProposal]
  );

  useEffect(() => {
    if (!isReassignMode) {
      setDropTargetEmployeeId(null);
    }
  }, [isReassignMode]);

  const handleNodeDragStart: OnNodeDrag<OrgChartFlowNode> = useCallback(
    (_event, draggedNode) => {
      dragStartPositionRef.current = { ...draggedNode.position };
      setDropTargetEmployeeId(null);
    },
    []
  );

  const handleNodeDrag: OnNodeDrag<OrgChartFlowNode> = useCallback(
    (_event, draggedNode) => {
      if (!isReassignMode || !onReassignProposal) return;
      const target = findDropTarget(nodes, draggedNode);
      setDropTargetEmployeeId(target?.id ?? null);
    },
    [isReassignMode, nodes, onReassignProposal]
  );

  const handleNodeDragStop: OnNodeDrag<OrgChartFlowNode> = useCallback(
    (_event, draggedNode) => {
      dragStartPositionRef.current = null;

      if (!isReassignMode || !onReassignProposal) {
        // Reset drop state; recompute snaps the node back to its layout position.
        setDropTargetEmployeeId((current) => (current ? null : current));
        return;
      }

      const target =
        (dropTargetEmployeeId
          ? nodes.find((candidate) => candidate.id === dropTargetEmployeeId)
          : undefined) ?? findDropTarget(nodes, draggedNode);

      // Clearing drop state triggers a layout recompute, snapping the dragged node back.
      setDropTargetEmployeeId(null);

      if (!target) return;

      const draggedEmployee = draggedNode.data.employee;
      const targetEmployee = target.data.employee;
      if (targetEmployee.employeeId === draggedEmployee.managerId) return;

      onReassignProposal({
        employee: draggedEmployee,
        proposedManager: targetEmployee,
      });
    },
    [dropTargetEmployeeId, isReassignMode, nodes, onReassignProposal]
  );

  return (
    <OrgChartFlowFrame<OrgChartFlowNode>
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      nodeWidth={ORG_CHART_NODE_WIDTH}
      nodeHeight={ORG_CHART_NODE_HEIGHT}
      fitViewKey={fitViewKey}
      isOverviewMode={isOverviewMode}
      overviewSelectedId={selectedEmployeeId}
      getNodeLevel={getEmployeeLevel}
      focusNodeId={focusEmployeeId}
      focusRequestKey={focusRequestKey}
      onCanvasApiReady={onCanvasApiReady}
      onNodeClick={onSelectEmployee}
      nodesDraggable={isReassignMode && !!onReassignProposal}
      nodeDragThreshold={8}
      onNodeDragStart={handleNodeDragStart}
      onNodeDrag={handleNodeDrag}
      onNodeDragStop={handleNodeDragStop}
    />
  );
}
