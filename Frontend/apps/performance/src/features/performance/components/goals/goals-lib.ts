import type { GoalNodeDto, ObjectiveLifecycleState } from "@repo/api";

export interface GoalGraph {
  byId: Map<string, GoalNodeDto>;
  childrenByParent: Map<string, GoalNodeDto[]>;
  roots: GoalNodeDto[];
}

/** Builds the parent/child indexes for the Alignment Map from the flat node list. */
export function buildGoalGraph(nodes: GoalNodeDto[]): GoalGraph {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string, GoalNodeDto[]>();
  for (const node of nodes) {
    if (!node.parentObjectiveId) continue;
    const list = childrenByParent.get(node.parentObjectiveId) ?? [];
    list.push(node);
    childrenByParent.set(node.parentObjectiveId, list);
  }
  const roots = nodes
    .filter((node) => node.ownershipScope === "Company")
    .sort((a, b) => a.title.localeCompare(b.title));
  return { byId, childrenByParent, roots };
}

/** The ancestor path from a root down to (and excluding) the given node. */
export function pathTo(graph: GoalGraph, nodeId: string): GoalNodeDto[] {
  const trail: GoalNodeDto[] = [];
  let current = graph.byId.get(nodeId);
  const guard = new Set<string>();
  while (current?.parentObjectiveId && !guard.has(current.id)) {
    guard.add(current.id);
    const parent = graph.byId.get(current.parentObjectiveId);
    if (!parent) break;
    trail.unshift(parent);
    current = parent;
  }
  return trail;
}

export const STATE_TONE: Record<ObjectiveLifecycleState, "neutral" | "info" | "success" | "warning" | "muted"> = {
  Draft: "muted",
  Submitted: "warning",
  Approved: "success",
  Published: "success",
};

export const STATE_LABEL: Record<ObjectiveLifecycleState, string> = {
  Draft: "Draft",
  Submitted: "Awaiting decision",
  Approved: "Approved",
  Published: "Published",
};

export function scopeLabel(node: GoalNodeDto): string {
  if (node.ownershipScope === "Company") return "Company";
  if (node.ownershipScope === "OrgUnit") return node.orgUnitName ?? "Organization unit";
  return "Employee";
}

export function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}
