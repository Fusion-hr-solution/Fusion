import dagre from "dagre";
import {
  MarkerType,
  Position,
  type Edge,
  type Node,
} from "@xyflow/react";
import type {
  EmployeeOrgChartNodeDto,
  OrgChartSearchItem,
} from "./org-chart.types";

export const ORG_CHART_NODE_WIDTH = 288;
export const ORG_CHART_NODE_HEIGHT = 184;

export type OrgChartFlowNodeData = Record<string, unknown> & {
  employee: EmployeeOrgChartNodeDto;
  isCollapsed: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  isOnSelectedPath: boolean;
  isInSelectedNeighborhood: boolean;
  isDeemphasized: boolean;
  hasVisibleParent: boolean;
  hasVisibleChildren: boolean;
  onSelectEmployee: (employeeId: string) => void;
  onToggleCollapse: (employeeId: string) => void;
};

export type OrgChartFlowNode = Node<OrgChartFlowNodeData, "employeeOrgChart">;

interface CreateOrgChartFlowOptions {
  roots: EmployeeOrgChartNodeDto[];
  collapsedEmployeeIds: Set<string>;
  selectedEmployeeId: string | null;
  highlightedEmployeeId: string | null;
  onSelectEmployee: (employeeId: string) => void;
  onToggleCollapse: (employeeId: string) => void;
}

export function flattenOrgChart(
  roots: EmployeeOrgChartNodeDto[]
): EmployeeOrgChartNodeDto[] {
  const flattened: EmployeeOrgChartNodeDto[] = [];

  const visit = (node: EmployeeOrgChartNodeDto) => {
    flattened.push(node);
    node.children.forEach(visit);
  };

  roots.forEach(visit);
  return flattened;
}

export function buildOrgChartSearchIndex(
  roots: EmployeeOrgChartNodeDto[]
): OrgChartSearchItem[] {
  return flattenOrgChart(roots).map((employee) => ({
    employeeId: employee.employeeId,
    fullName: employee.fullName,
    jobTitle: employee.jobTitle,
    orgUnitName: employee.orgUnitName,
  }));
}

export function findEmployeePath(
  roots: EmployeeOrgChartNodeDto[],
  targetEmployeeId: string
): string[] {
  const visit = (
    node: EmployeeOrgChartNodeDto,
    ancestors: string[]
  ): string[] | null => {
    const nextAncestors = [...ancestors, node.employeeId];

    if (node.employeeId === targetEmployeeId) {
      return nextAncestors;
    }

    for (const child of node.children) {
      const childPath = visit(child, nextAncestors);
      if (childPath) {
        return childPath;
      }
    }

    return null;
  };

  for (const root of roots) {
    const path = visit(root, []);
    if (path) {
      return path;
    }
  }

  return [];
}

export function createOrgChartFlow({
  roots,
  collapsedEmployeeIds,
  selectedEmployeeId,
  highlightedEmployeeId,
  onSelectEmployee,
  onToggleCollapse,
}: CreateOrgChartFlowOptions): {
  nodes: OrgChartFlowNode[];
  edges: Edge[];
} {
  const visibleNodes: EmployeeOrgChartNodeDto[] = [];
  const visibleEdges: Array<{ source: string; target: string }> = [];
  const parentById = new Map<string, string>();

  const visit = (node: EmployeeOrgChartNodeDto, parentId?: string) => {
    visibleNodes.push(node);

    if (parentId) {
      visibleEdges.push({ source: parentId, target: node.employeeId });
      parentById.set(node.employeeId, parentId);
    }

    if (collapsedEmployeeIds.has(node.employeeId)) {
      return;
    }

    node.children.forEach((child) => visit(child, node.employeeId));
  };

  roots.forEach((root) => visit(root));

  const visibleNodeIds = new Set(visibleNodes.map((node) => node.employeeId));
  const hasVisibleSelection =
    selectedEmployeeId !== null && visibleNodeIds.has(selectedEmployeeId);
  const selectedPathIds = new Set(
    hasVisibleSelection && selectedEmployeeId
      ? findEmployeePath(roots, selectedEmployeeId)
      : []
  );
  const selectedNeighborhoodIds = new Set(selectedPathIds);

  if (hasVisibleSelection && selectedEmployeeId) {
    const selectedNode = visibleNodes.find(
      (node) => node.employeeId === selectedEmployeeId
    );

    selectedNode?.children.forEach((child) => {
      if (visibleNodeIds.has(child.employeeId)) {
        selectedNeighborhoodIds.add(child.employeeId);
      }
    });
  }

  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "TB",
    nodesep: 36,
    ranksep: 88,
    marginx: 32,
    marginy: 32,
  });

  visibleNodes.forEach((node) => {
    graph.setNode(node.employeeId, {
      width: ORG_CHART_NODE_WIDTH,
      height: ORG_CHART_NODE_HEIGHT,
    });
  });

  visibleEdges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target);
  });

  dagre.layout(graph);

  const nodes: OrgChartFlowNode[] = visibleNodes.map((node) => {
    const position = graph.node(node.employeeId) ?? {
      x: ORG_CHART_NODE_WIDTH / 2,
      y: ORG_CHART_NODE_HEIGHT / 2,
    };
    const isSelected = selectedEmployeeId === node.employeeId;
    const isOnSelectedPath =
      !isSelected && hasVisibleSelection && selectedPathIds.has(node.employeeId);
    const isInSelectedNeighborhood =
      hasVisibleSelection && selectedNeighborhoodIds.has(node.employeeId);

    return {
      id: node.employeeId,
      type: "employeeOrgChart",
      position: {
        x: position.x - ORG_CHART_NODE_WIDTH / 2,
        y: position.y - ORG_CHART_NODE_HEIGHT / 2,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      draggable: false,
      selectable: false,
      data: {
        employee: node,
        isCollapsed: collapsedEmployeeIds.has(node.employeeId),
        isSelected,
        isHighlighted: highlightedEmployeeId === node.employeeId,
        isOnSelectedPath,
        isInSelectedNeighborhood,
        isDeemphasized: hasVisibleSelection && !isInSelectedNeighborhood,
        hasVisibleParent: parentById.has(node.employeeId),
        hasVisibleChildren: node.children.some((child) =>
          visibleNodeIds.has(child.employeeId)
        ),
        onSelectEmployee,
        onToggleCollapse,
      },
    };
  });

  const edges: Edge[] = visibleEdges.map((edge) => ({
    id: `${edge.source}-${edge.target}`,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color:
        hasVisibleSelection &&
        ((selectedEmployeeId !== null && edge.source === selectedEmployeeId) ||
          (selectedEmployeeId !== null && edge.target === selectedEmployeeId) ||
          (selectedPathIds.has(edge.source) && selectedPathIds.has(edge.target)))
          ? "hsl(var(--primary))"
          : "hsl(var(--border))",
    },
    style: {
      stroke:
        hasVisibleSelection &&
        ((selectedEmployeeId !== null && edge.source === selectedEmployeeId) ||
          (selectedEmployeeId !== null && edge.target === selectedEmployeeId) ||
          (selectedPathIds.has(edge.source) && selectedPathIds.has(edge.target)))
          ? "hsl(var(--primary))"
          : "hsl(var(--border))",
      strokeWidth:
        hasVisibleSelection &&
        ((selectedEmployeeId !== null && edge.source === selectedEmployeeId) ||
          (selectedEmployeeId !== null && edge.target === selectedEmployeeId) ||
          (selectedPathIds.has(edge.source) && selectedPathIds.has(edge.target)))
          ? 2.5
          : 1.25,
      opacity:
        hasVisibleSelection &&
        !(
          (selectedEmployeeId !== null && edge.source === selectedEmployeeId) ||
          (selectedEmployeeId !== null && edge.target === selectedEmployeeId) ||
          (selectedPathIds.has(edge.source) && selectedPathIds.has(edge.target))
        )
          ? 0.3
          : 1,
    },
  }));

  return { nodes, edges };
}