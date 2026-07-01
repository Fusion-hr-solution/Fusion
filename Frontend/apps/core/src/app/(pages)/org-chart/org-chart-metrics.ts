import type { EmployeeOrgChartNodeDto, SpanOfControl } from "./org-chart.types";

/**
 * Count descendants of `node` that are present in the loaded tree. This is intentionally
 * scoped to the *visible* tree: it never counts nodes outside the caller's loaded subtree,
 * so the metric stays permission- and depth-consistent (org-chart spec: metrics must be
 * scope-consistent, not whole-org leaks). Server-side recursive downline is deferred.
 */
export function computeVisibleDownline(node: EmployeeOrgChartNodeDto): number {
  let total = 0;
  for (const child of node.children) {
    total += 1 + computeVisibleDownline(child);
  }
  return total;
}

/** Span-of-control summary for the side panel: authoritative direct reports + visible downline. */
export function getSpanOfControl(node: EmployeeOrgChartNodeDto): SpanOfControl {
  return {
    directReports: node.directReportCount,
    visibleDownline: computeVisibleDownline(node),
  };
}

/** Count direct child units of an org-unit tree node. */
export function countChildUnits<T extends { children: T[] }>(node: T): number {
  return node.children.length;
}
