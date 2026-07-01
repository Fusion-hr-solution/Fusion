"use client";

import { useMemo } from "react";
import { type NodeTypes } from "@xyflow/react";
import {
  createOrgUnitFlow,
  type OrgUnitFlowNode,
  ORG_UNIT_NODE_WIDTH,
  ORG_UNIT_NODE_HEIGHT,
} from "./org-chart-layout";
import { OrgUnitNode } from "./org-unit-node";
import {
  OrgChartFlowFrame,
  type OrgChartCanvasApi,
} from "./org-chart-flow-frame";
import type { OrgUnitTreeNodeDto } from "./org-chart.types";

const nodeTypes = {
  orgUnit: OrgUnitNode,
} satisfies NodeTypes;

interface OrgUnitCanvasProps {
  roots: OrgUnitTreeNodeDto[];
  collapsedUnitIds: Set<string>;
  selectedUnitId: string | null;
  highlightedUnitId: string | null;
  onSelectUnit: (unitId: string) => void;
  onToggleCollapse: (unitId: string) => void;
  focusUnitId: string | null;
  focusRequestKey: number;
  fitViewKey: string;
  isOverviewMode: boolean;
  onCanvasApiReady?: (api: OrgChartCanvasApi | null) => void;
}

function getUnitLevel(node: OrgUnitFlowNode): number {
  return node.data.unit.level;
}

export function OrgUnitCanvas({
  roots,
  collapsedUnitIds,
  selectedUnitId,
  highlightedUnitId,
  onSelectUnit,
  onToggleCollapse,
  focusUnitId,
  focusRequestKey,
  fitViewKey,
  isOverviewMode,
  onCanvasApiReady,
}: OrgUnitCanvasProps) {
  const { nodes, edges } = useMemo(
    () =>
      createOrgUnitFlow({
        roots,
        collapsedUnitIds,
        selectedUnitId,
        highlightedUnitId,
        onSelectUnit,
        onToggleCollapse,
      }),
    [
      collapsedUnitIds,
      highlightedUnitId,
      onSelectUnit,
      onToggleCollapse,
      roots,
      selectedUnitId,
    ]
  );

  return (
    <OrgChartFlowFrame<OrgUnitFlowNode>
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      nodeWidth={ORG_UNIT_NODE_WIDTH}
      nodeHeight={ORG_UNIT_NODE_HEIGHT}
      fitViewKey={fitViewKey}
      isOverviewMode={isOverviewMode}
      overviewSelectedId={selectedUnitId}
      getNodeLevel={getUnitLevel}
      focusNodeId={focusUnitId}
      focusRequestKey={focusRequestKey}
      onCanvasApiReady={onCanvasApiReady}
      onNodeClick={onSelectUnit}
    />
  );
}
