"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeTypes,
  type OnNodeDrag,
  type ReactFlowInstance,
} from "@xyflow/react";
import { exportFlowToPng } from "./org-chart-export";

export interface OrgChartCanvasApi {
  fitToScreen: () => void;
  resetView: () => void;
  focusNode: (nodeId: string) => void;
  /** Rasterise the whole graph to a PNG data URL (null if nothing is rendered). */
  exportToPng: () => Promise<string | null>;
}

interface OrgChartFlowFrameProps<TNode extends Node> {
  nodes: TNode[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  nodeWidth: number;
  nodeHeight: number;
  /** Changes whenever the loaded dataset/scope changes — triggers a default fit. */
  fitViewKey: string;
  isOverviewMode: boolean;
  overviewSelectedId?: string | null;
  getNodeLevel: (node: TNode) => number;
  focusNodeId: string | null;
  focusRequestKey: number;
  onCanvasApiReady?: (api: OrgChartCanvasApi | null) => void;
  onNodeClick: (nodeId: string) => void;
  nodesDraggable?: boolean;
  nodeDragThreshold?: number;
  onNodeDragStart?: OnNodeDrag<TNode>;
  onNodeDrag?: OnNodeDrag<TNode>;
  onNodeDragStop?: OnNodeDrag<TNode>;
}

export function OrgChartFlowFrame<TNode extends Node>({
  nodes,
  edges,
  nodeTypes,
  nodeWidth,
  nodeHeight,
  fitViewKey,
  isOverviewMode,
  overviewSelectedId,
  getNodeLevel,
  focusNodeId,
  focusRequestKey,
  onCanvasApiReady,
  onNodeClick,
  nodesDraggable = false,
  nodeDragThreshold,
  onNodeDragStart,
  onNodeDrag,
  onNodeDragStop,
}: OrgChartFlowFrameProps<TNode>) {
  const [instance, setInstance] = useState<ReactFlowInstance<
    TNode,
    Edge
  > | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fitDefaultView = useCallback(() => {
    if (!instance || nodes.length === 0) {
      return;
    }

    if (isOverviewMode && nodes.length > 24) {
      const overviewLevel = nodes.length > 80 ? 0 : 1;
      const overviewNodes = nodes.filter(
        (node) =>
          getNodeLevel(node) <= overviewLevel || node.id === overviewSelectedId
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
  }, [getNodeLevel, instance, isOverviewMode, nodes, overviewSelectedId]);

  const fitDefaultViewRef = useRef(fitDefaultView);
  fitDefaultViewRef.current = fitDefaultView;

  const centerNode = useCallback(
    (nodeId: string, options?: { yOffset?: number; duration?: number }) => {
      if (!instance) return;
      const node = instance.getNode(nodeId);
      if (!node) return;

      instance.setCenter(
        node.position.x + nodeWidth / 2,
        node.position.y + nodeHeight / 2 + (options?.yOffset ?? 0),
        { zoom: instance.getZoom(), duration: options?.duration ?? 220 }
      );
    },
    [instance, nodeHeight, nodeWidth]
  );

  useEffect(() => {
    if (!onCanvasApiReady) return;

    if (!instance) {
      onCanvasApiReady(null);
      return;
    }

    onCanvasApiReady({
      fitToScreen: () => instance.fitView({ duration: 250, padding: 0.2 }),
      resetView: () => fitDefaultViewRef.current(),
      focusNode: (nodeId: string) =>
        centerNode(nodeId, { yOffset: nodeHeight * 0.2, duration: 240 }),
      exportToPng: async () => {
        const viewportEl = containerRef.current?.querySelector<HTMLElement>(
          ".react-flow__viewport"
        );
        if (!viewportEl) return null;
        const background =
          containerRef.current &&
          getComputedStyle(containerRef.current).backgroundColor;
        return exportFlowToPng(
          instance as unknown as ReactFlowInstance<Node, Edge>,
          viewportEl,
          background || "#ffffff"
        );
      },
    });
  }, [centerNode, instance, nodeHeight, onCanvasApiReady]);

  useEffect(() => {
    fitDefaultViewRef.current();
  }, [fitViewKey]);

  useEffect(() => {
    if (!instance || !focusNodeId) return;
    if (!instance.getNode(focusNodeId)) return;
    centerNode(focusNodeId, { yOffset: nodeHeight * 0.2, duration: 240 });
  }, [centerNode, focusNodeId, focusRequestKey, instance, nodeHeight, nodes]);

  // Node positions are owned by the Dagre layout — we never persist drag positions. After a
  // drag ends, snap every node back to the controlled layout so a released node returns home.
  const handleNodeDragStop: OnNodeDrag<TNode> = useCallback(
    (event, node, draggedNodes) => {
      onNodeDragStop?.(event, node, draggedNodes);
      instance?.setNodes(nodes);
    },
    [instance, nodes, onNodeDragStop]
  );

  return (
    <div ref={containerRef} className="h-full w-full">
      <ReactFlow<TNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        minZoom={0.2}
        maxZoom={1.5}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable={nodesDraggable}
        nodeDragThreshold={nodeDragThreshold}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        panOnScroll={false}
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        onInit={setInstance}
        onNodeClick={(_event, node) => onNodeClick(node.id)}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        className="bg-background"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={0.75}
          color="var(--color-border)"
        />
        <Controls showInteractive position="bottom-right" />
        <MiniMap
          pannable
          zoomable
          ariaLabel="Org chart minimap"
          className="!bottom-3 !right-16 !rounded-lg !border !border-border !bg-card/90 !shadow-sm"
          maskColor="color-mix(in oklab, var(--color-muted) 60%, transparent)"
          nodeColor="var(--color-muted-foreground)"
          nodeStrokeWidth={0}
        />
      </ReactFlow>
    </div>
  );
}
