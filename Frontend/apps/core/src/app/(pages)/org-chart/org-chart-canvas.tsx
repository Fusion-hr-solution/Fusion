"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Edge,
  type OnNodeDrag,
  type NodeTypes,
  type ReactFlowInstance,
  type XYPosition,
} from "@xyflow/react";
import {
  createOrgChartFlow,
  type OrgChartFlowNode,
  ORG_CHART_NODE_WIDTH,
  ORG_CHART_NODE_HEIGHT,
} from "./org-chart-layout";
import { OrgChartNode } from "./org-chart-node";
import type { EmployeeOrgChartNodeDto } from "./org-chart.types";
import type { ManagerReassignProposal } from "./manager-reassign-dialog";

const nodeTypes = {
  employeeOrgChart: OrgChartNode,
} satisfies NodeTypes;

export interface OrgChartCanvasApi {
  fitToScreen: () => void;
  resetView: () => void;
  focusNode: (nodeId: string) => void;
}

interface OrgChartCanvasProps {
  roots: EmployeeOrgChartNodeDto[];
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

export function OrgChartCanvas({
  roots,
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
  const { nodes, edges } = useMemo(
    () =>
      createOrgChartFlow({
        roots,
        collapsedEmployeeIds,
        selectedEmployeeId,
        highlightedEmployeeId,
        onSelectEmployee,
        onToggleCollapse,
      }),
    [
      collapsedEmployeeIds,
      highlightedEmployeeId,
      onSelectEmployee,
      onToggleCollapse,
      roots,
      selectedEmployeeId,
    ]
  );
  const [instance, setInstance] = useState<ReactFlowInstance<
    OrgChartFlowNode,
    Edge
  > | null>(null);
  // Store original position at drag-start so we can snap back on drop
  const dragStartPositionRef = useRef<XYPosition | null>(null);

  const fitDefaultView = useCallback(() => {
    if (!instance || nodes.length === 0) {
      return;
    }

    if (isOverviewMode && nodes.length > 24) {
      const overviewLevel = nodes.length > 80 ? 0 : 1;
      const overviewNodes = nodes.filter(
        (node) =>
          node.data.employee.level <= overviewLevel ||
          node.id === selectedEmployeeId
      );

      instance.fitView({
        nodes: overviewNodes.length > 0 ? overviewNodes : nodes,
        duration: 250,
        padding: 0.22,
        maxZoom: 0.9,
      });
      return;
    }

    instance.fitView({
      duration: 250,
      padding: 0.2,
      minZoom: 0.38,
      maxZoom: 1,
    });
  }, [instance, isOverviewMode, nodes, selectedEmployeeId]);

  const fitDefaultViewRef = useRef(fitDefaultView);
  fitDefaultViewRef.current = fitDefaultView;

  const centerNode = useCallback(
    (nodeId: string, options?: { yOffset?: number; duration?: number }) => {
      if (!instance) {
        return;
      }

      const node = instance.getNode(nodeId);
      if (!node) {
        return;
      }

      const currentZoom = instance.getZoom();
      instance.setCenter(
        node.position.x + ORG_CHART_NODE_WIDTH / 2,
        node.position.y + ORG_CHART_NODE_HEIGHT / 2 + (options?.yOffset ?? 0),
        {
          zoom: currentZoom,
          duration: options?.duration ?? 220,
        }
      );
    },
    [instance]
  );

  useEffect(() => {
    if (!onCanvasApiReady) {
      return;
    }

    if (!instance) {
      onCanvasApiReady(null);
      return;
    }

    onCanvasApiReady({
      fitToScreen: () => {
        instance.fitView({ duration: 250, padding: 0.2 });
      },
      resetView: () => {
        fitDefaultViewRef.current();
      },
      focusNode: (nodeId: string) => {
        centerNode(nodeId, {
          yOffset: ORG_CHART_NODE_HEIGHT * 0.2,
          duration: 240,
        });
      },
    });
  }, [centerNode, fitDefaultView, instance, onCanvasApiReady]);

  useEffect(() => {
    fitDefaultViewRef.current();
  }, [fitViewKey]);

  useEffect(() => {
    if (!instance || !focusEmployeeId) {
      return;
    }

    const targetNode = instance.getNode(focusEmployeeId);
    if (!targetNode) {
      return;
    }

    centerNode(focusEmployeeId, {
      yOffset: ORG_CHART_NODE_HEIGHT * 0.2,
      duration: 240,
    });
  }, [centerNode, focusEmployeeId, focusRequestKey, instance, nodes]);

  const handleNodeDragStart: OnNodeDrag<OrgChartFlowNode> = useCallback(
    (_event, draggedNode) => {
      dragStartPositionRef.current = { ...draggedNode.position };
    },
    []
  );

  const handleNodeDragStop: OnNodeDrag<OrgChartFlowNode> = useCallback(
    (_event, draggedNode) => {
      if (!instance || !onReassignProposal) {
        // Snap back immediately since we don't handle drag without a handler
        if (instance && dragStartPositionRef.current) {
          const snapPos = dragStartPositionRef.current;
          instance.setNodes((currentNodes) =>
            (currentNodes as OrgChartFlowNode[]).map((n) =>
              n.id === draggedNode.id ? { ...n, position: snapPos } : n
            )
          );
        }
        return;
      }

      const originalPos = dragStartPositionRef.current;

      // Always snap the dragged node back to its original layout position
      const snapPos = originalPos;
      instance.setNodes((currentNodes) =>
        (currentNodes as OrgChartFlowNode[]).map((n) =>
          n.id === draggedNode.id
            ? { ...n, position: snapPos ?? n.position }
            : n
        )
      );

      // Bounding-box hit test: find the topmost node that overlaps the dropped position
      const draggedX = draggedNode.position.x;
      const draggedY = draggedNode.position.y;
      const allNodes = instance.getNodes() as OrgChartFlowNode[];

      const target = allNodes.find((candidate) => {
        if (candidate.id === draggedNode.id) return false;
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

      if (!target) return;

      const draggedEmployee = (draggedNode as OrgChartFlowNode).data.employee;
      const targetEmployee = target.data.employee;

      // Skip trivial no-ops (dropping onto current manager)
      if (targetEmployee.employeeId === draggedEmployee.managerId) return;

      onReassignProposal({
        employee: draggedEmployee,
        proposedManager: targetEmployee,
      });
    },
    [instance, onReassignProposal]
  );

  return (
    <div className="h-full w-full">
      <ReactFlow<OrgChartFlowNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        minZoom={0.2}
        maxZoom={1.5}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable={!!onReassignProposal}
        nodeDragThreshold={8}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        panOnScroll={false}
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        onInit={setInstance}
        onNodeClick={(_event, node) => onSelectEmployee(node.id)}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        className="bg-background"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={0.75}
          color="var(--color-border)"
        />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  );
}
