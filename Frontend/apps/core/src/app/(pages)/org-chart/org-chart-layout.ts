import dagre from "dagre";
import { Position, type Edge, type Node } from "@xyflow/react";
import type {
  EmployeeOrgChartNodeDto,
  OrgChartSearchItem,
  OrgUnitSearchItem,
  OrgUnitTreeNodeDto,
} from "./org-chart.types";

export const ORG_CHART_NODE_WIDTH = 288;
export const ORG_CHART_NODE_HEIGHT = 188;

export const ORG_UNIT_NODE_WIDTH = 252;
export const ORG_UNIT_NODE_HEIGHT = 128;

export type OrgChartFlowNodeData = Record<string, unknown> & {
  employee: EmployeeOrgChartNodeDto;
  showJobTitle: boolean;
  isReassignMode: boolean;
  isDropTarget: boolean;
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

export type OrgUnitFlowNodeData = Record<string, unknown> & {
  unit: OrgUnitTreeNodeDto;
  isCollapsed: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  isOnSelectedPath: boolean;
  isDeemphasized: boolean;
  hasVisibleParent: boolean;
  hasVisibleChildren: boolean;
  onSelectUnit: (unitId: string) => void;
  onToggleCollapse: (unitId: string) => void;
};

export type OrgUnitFlowNode = Node<OrgUnitFlowNodeData, "orgUnit">;

interface CreateOrgChartFlowOptions {
  roots: EmployeeOrgChartNodeDto[];
  collapsedEmployeeIds: Set<string>;
  selectedEmployeeId: string | null;
  highlightedEmployeeId: string | null;
  showJobTitle: boolean;
  isReassignMode: boolean;
  dropTargetEmployeeId: string | null;
  onSelectEmployee: (employeeId: string) => void;
  onToggleCollapse: (employeeId: string) => void;
}

interface CreateOrgUnitFlowOptions {
  roots: OrgUnitTreeNodeDto[];
  collapsedUnitIds: Set<string>;
  selectedUnitId: string | null;
  highlightedUnitId: string | null;
  onSelectUnit: (unitId: string) => void;
  onToggleCollapse: (unitId: string) => void;
}

// ---------------------------------------------------------------------------
// Generic tree helpers (work for either people or org-unit trees)
// ---------------------------------------------------------------------------

function flattenTree<T extends { children: T[] }>(roots: T[]): T[] {
  const flattened: T[] = [];
  const visit = (node: T) => {
    flattened.push(node);
    node.children.forEach(visit);
  };
  roots.forEach(visit);
  return flattened;
}

function findPath<T extends { children: T[] }>(
  roots: T[],
  getId: (node: T) => string,
  targetId: string
): string[] {
  const visit = (node: T, ancestors: string[]): string[] | null => {
    const nextAncestors = [...ancestors, getId(node)];
    if (getId(node) === targetId) {
      return nextAncestors;
    }
    for (const child of node.children) {
      const childPath = visit(child, nextAncestors);
      if (childPath) return childPath;
    }
    return null;
  };

  for (const root of roots) {
    const path = visit(root, []);
    if (path) return path;
  }
  return [];
}

/** Run a Dagre top-down layout and return top-left positions keyed by node id. */
function runDagreLayout(
  nodeIds: string[],
  edges: Array<{ source: string; target: string }>,
  nodeWidth: number,
  nodeHeight: number
): Map<string, { x: number; y: number }> {
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "TB",
    nodesep: 36,
    ranksep: 88,
    marginx: 32,
    marginy: 32,
  });

  nodeIds.forEach((id) => {
    graph.setNode(id, { width: nodeWidth, height: nodeHeight });
  });
  edges.forEach((edge) => graph.setEdge(edge.source, edge.target));

  dagre.layout(graph);

  const positions = new Map<string, { x: number; y: number }>();
  nodeIds.forEach((id) => {
    const center = graph.node(id) ?? {
      x: nodeWidth / 2,
      y: nodeHeight / 2,
    };
    positions.set(id, {
      x: center.x - nodeWidth / 2,
      y: center.y - nodeHeight / 2,
    });
  });
  return positions;
}

/** Walk a tree honouring collapsed ids, collecting visible nodes + parent/child edges. */
function collectVisible<T extends { children: T[] }>(
  roots: T[],
  getId: (node: T) => string,
  collapsedIds: Set<string>
): {
  visibleNodes: T[];
  visibleEdges: Array<{ source: string; target: string }>;
  parentById: Map<string, string>;
} {
  const visibleNodes: T[] = [];
  const visibleEdges: Array<{ source: string; target: string }> = [];
  const parentById = new Map<string, string>();

  const visit = (node: T, parentId?: string) => {
    visibleNodes.push(node);
    const id = getId(node);
    if (parentId) {
      visibleEdges.push({ source: parentId, target: id });
      parentById.set(id, parentId);
    }
    if (collapsedIds.has(id)) return;
    node.children.forEach((child) => visit(child, id));
  };

  roots.forEach((root) => visit(root));
  return { visibleNodes, visibleEdges, parentById };
}

function buildTreeEdges(
  visibleEdges: Array<{ source: string; target: string }>,
  selectedPathIds: Set<string>,
  hasVisibleSelection: boolean
): Edge[] {
  return visibleEdges.map((edge) => {
    const onPath =
      hasVisibleSelection &&
      selectedPathIds.has(edge.source) &&
      selectedPathIds.has(edge.target);

    return {
      id: `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      type: "step",
      animated: false,
      style: {
        stroke: onPath ? "var(--color-primary)" : "var(--color-border)",
        strokeWidth: onPath ? 2.5 : 1.75,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        opacity: onPath ? 0.95 : hasVisibleSelection ? 0.45 : 0.9,
      },
    } satisfies Edge;
  });
}

// ---------------------------------------------------------------------------
// People-tree exports
// ---------------------------------------------------------------------------

export function flattenOrgChart(
  roots: EmployeeOrgChartNodeDto[]
): EmployeeOrgChartNodeDto[] {
  return flattenTree(roots);
}

export function buildOrgChartSearchIndex(
  roots: EmployeeOrgChartNodeDto[],
  showJobTitle = true
): OrgChartSearchItem[] {
  return flattenOrgChart(roots).map((employee) => ({
    employeeId: employee.employeeId,
    fullName: employee.fullName,
    jobTitle: showJobTitle ? employee.jobTitle : null,
    orgUnitName: employee.orgUnitName,
  }));
}

export function findEmployeePath(
  roots: EmployeeOrgChartNodeDto[],
  targetEmployeeId: string
): string[] {
  return findPath(roots, (node) => node.employeeId, targetEmployeeId);
}

export function createOrgChartFlow({
  roots,
  collapsedEmployeeIds,
  selectedEmployeeId,
  highlightedEmployeeId,
  showJobTitle,
  isReassignMode,
  dropTargetEmployeeId,
  onSelectEmployee,
  onToggleCollapse,
}: CreateOrgChartFlowOptions): {
  nodes: OrgChartFlowNode[];
  edges: Edge[];
} {
  const { visibleNodes, visibleEdges, parentById } = collectVisible(
    roots,
    (node) => node.employeeId,
    collapsedEmployeeIds
  );

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

  const positions = runDagreLayout(
    visibleNodes.map((node) => node.employeeId),
    visibleEdges,
    ORG_CHART_NODE_WIDTH,
    ORG_CHART_NODE_HEIGHT
  );

  const nodes: OrgChartFlowNode[] = visibleNodes.map((node) => {
    const position = positions.get(node.employeeId) ?? { x: 0, y: 0 };
    const isSelected = selectedEmployeeId === node.employeeId;
    const isOnSelectedPath =
      !isSelected &&
      hasVisibleSelection &&
      selectedPathIds.has(node.employeeId);
    const isInSelectedNeighborhood =
      hasVisibleSelection && selectedNeighborhoodIds.has(node.employeeId);

    return {
      id: node.employeeId,
      type: "employeeOrgChart",
      position,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      draggable: false,
      selectable: false,
      data: {
        employee: node,
        showJobTitle,
        isReassignMode,
        isDropTarget: dropTargetEmployeeId === node.employeeId,
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

  const edges = buildTreeEdges(
    visibleEdges,
    selectedPathIds,
    hasVisibleSelection
  );
  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Org-unit (structure) tree exports
// ---------------------------------------------------------------------------

export function flattenOrgUnitTree(
  roots: OrgUnitTreeNodeDto[]
): OrgUnitTreeNodeDto[] {
  return flattenTree(roots);
}

export function buildOrgUnitSearchIndex(
  roots: OrgUnitTreeNodeDto[]
): OrgUnitSearchItem[] {
  return flattenOrgUnitTree(roots).map((unit) => ({
    orgUnitId: unit.id,
    code: unit.code,
    name: unit.name,
    type: unit.type,
    childUnitCount: unit.children.length,
  }));
}

export function findUnitPath(
  roots: OrgUnitTreeNodeDto[],
  targetUnitId: string
): string[] {
  return findPath(roots, (node) => node.id, targetUnitId);
}

export function createOrgUnitFlow({
  roots,
  collapsedUnitIds,
  selectedUnitId,
  highlightedUnitId,
  onSelectUnit,
  onToggleCollapse,
}: CreateOrgUnitFlowOptions): {
  nodes: OrgUnitFlowNode[];
  edges: Edge[];
} {
  const { visibleNodes, visibleEdges, parentById } = collectVisible(
    roots,
    (node) => node.id,
    collapsedUnitIds
  );

  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const hasVisibleSelection =
    selectedUnitId !== null && visibleNodeIds.has(selectedUnitId);
  const selectedPathIds = new Set(
    hasVisibleSelection && selectedUnitId
      ? findUnitPath(roots, selectedUnitId)
      : []
  );

  const positions = runDagreLayout(
    visibleNodes.map((node) => node.id),
    visibleEdges,
    ORG_UNIT_NODE_WIDTH,
    ORG_UNIT_NODE_HEIGHT
  );

  const nodes: OrgUnitFlowNode[] = visibleNodes.map((node) => {
    const position = positions.get(node.id) ?? { x: 0, y: 0 };
    const isSelected = selectedUnitId === node.id;
    const isOnSelectedPath =
      !isSelected && hasVisibleSelection && selectedPathIds.has(node.id);

    return {
      id: node.id,
      type: "orgUnit",
      position,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      draggable: false,
      selectable: false,
      data: {
        unit: node,
        isCollapsed: collapsedUnitIds.has(node.id),
        isSelected,
        isHighlighted: highlightedUnitId === node.id,
        isOnSelectedPath,
        isDeemphasized:
          hasVisibleSelection && !isSelected && !selectedPathIds.has(node.id),
        hasVisibleParent: parentById.has(node.id),
        hasVisibleChildren: node.children.some((child) =>
          visibleNodeIds.has(child.id)
        ),
        onSelectUnit,
        onToggleCollapse,
      },
    };
  });

  const edges = buildTreeEdges(
    visibleEdges,
    selectedPathIds,
    hasVisibleSelection
  );
  return { nodes, edges };
}
