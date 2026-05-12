"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Edge,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import { createOrgChartFlow, type OrgChartFlowNode } from "./org-chart-layout";
import { OrgChartNode } from "./org-chart-node";
import type { EmployeeOrgChartNodeDto } from "./org-chart.types";

const nodeTypes = {
  employeeOrgChart: OrgChartNode,
} satisfies NodeTypes;

export interface OrgChartCanvasApi {
  fitToScreen: () => void;
  resetView: () => void;
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
  const [instance, setInstance] = useState<
    ReactFlowInstance<OrgChartFlowNode, Edge> | null
  >(null);

  const fitDefaultView = useCallback(() => {
    if (!instance || nodes.length === 0) {
      return;
    }

    if (isOverviewMode && nodes.length > 24) {
      const overviewLevel = nodes.length > 80 ? 0 : 1;
      const overviewNodes = nodes.filter(
        (node) =>
          node.data.employee.level <= overviewLevel || node.id === selectedEmployeeId
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
        fitDefaultView();
      },
    });
  }, [fitDefaultView, instance, onCanvasApiReady]);

  useEffect(() => {
    fitDefaultView();
  }, [fitDefaultView, fitViewKey]);

  useEffect(() => {
    if (!instance || !focusEmployeeId) {
      return;
    }

    const targetNode = instance.getNode(focusEmployeeId);
    if (!targetNode) {
      return;
    }

    instance.fitView({
      nodes: [targetNode],
      duration: 300,
      maxZoom: 1.1,
      padding: 0.35,
    });
  }, [focusEmployeeId, focusRequestKey, instance, nodes]);

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
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        panOnScroll={false}
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        onInit={setInstance}
        className="bg-muted/20"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1}
          color="hsl(var(--border))"
        />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  );
}