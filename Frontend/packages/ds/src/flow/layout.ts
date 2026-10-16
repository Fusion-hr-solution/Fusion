import dagre from "dagre";

export interface TreeLayoutOptions {
  nodeWidth: number;
  nodeHeight: number;
  /** Horizontal gap between siblings. */
  nodesep: number;
  /** Vertical gap between depth levels. */
  ranksep: number;
  margin?: number;
  /** Per-node size when nodes differ (e.g. compact leaves); falls back to the defaults. */
  sizeOf?: (id: string) => { width: number; height: number } | undefined;
}

/**
 * Top-to-bottom tree layout (dagre `rankdir: TB`): roots sit on top, depth flows down and
 * siblings spread sideways. Returns each node's top-left position, ready for React Flow.
 */
export function layoutTree(
  ids: readonly string[],
  edges: ReadonlyArray<{ source: string; target: string }>,
  options: TreeLayoutOptions
): Map<string, { x: number; y: number }> {
  const margin = options.margin ?? 40;
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "TB",
    nodesep: options.nodesep,
    ranksep: options.ranksep,
    marginx: margin,
    marginy: margin,
  });
  const sizes = new Map<string, { width: number; height: number }>();
  for (const id of ids) {
    const custom = options.sizeOf?.(id);
    // A fresh label per node: dagre writes the computed x/y onto the label object, so a size shared
    // between nodes would give every node the same position.
    const size = {
      width: custom?.width ?? options.nodeWidth,
      height: custom?.height ?? options.nodeHeight,
    };
    sizes.set(id, size);
    graph.setNode(id, { ...size });
  }
  for (const edge of edges) graph.setEdge(edge.source, edge.target);
  dagre.layout(graph);

  const positions = new Map<string, { x: number; y: number }>();
  for (const id of ids) {
    const center = graph.node(id) ?? { x: 0, y: 0 };
    const size = sizes.get(id)!;
    positions.set(id, {
      x: center.x - size.width / 2,
      y: center.y - size.height / 2,
    });
  }
  return positions;
}
