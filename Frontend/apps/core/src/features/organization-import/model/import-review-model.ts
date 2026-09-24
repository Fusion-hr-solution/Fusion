import type {
  OrganizationImportIssue,
  OrganizationImportIssueSeverity,
  OrganizationImportResolutionKind,
  OrganizationImportReview,
  OrganizationImportReviewNode,
} from "@repo/api";

// The synthetic node that stands in for the one Organization root a file with several top-level
// units still needs. It lives only in the review tree so the missing root is visible in the
// hierarchy itself rather than announced as a detached blocker.
export const PLACEHOLDER_ROOT_ID = "__organization_root_required__";

// The synthetic grouping node that holds units whose parent reference didn't resolve, so they
// stay reviewable without a false parentage.
export const UNPLACED_PARENT_ID = "__unresolved_placement__";

/** Tree id of an existing unit the proposal hangs from. */
export const anchorTreeId = (unitId: string) => `existing:${unitId}`;

export type ReviewSelection =
  | { kind: "none" }
  | { kind: "unit"; nodeId: string }
  | { kind: "issues" }
  | { kind: "issue"; key: string };

/**
 * A Review issue as the server stated it, plus the tree ids it points at. Severity, message and
 * the resolution pathways are the server's; nothing here reinterprets them.
 */
export interface ReviewIssue {
  key: string;
  code: string;
  severity: OrganizationImportIssueSeverity;
  title: string;
  detail: string;
  /** Tree node ids to highlight; empty when the issue has no tree anchor. */
  nodeIds: string[];
  /** The one unit the issue is about, when it is about one unit. */
  anchorNodeId?: string;
  preferredResolution: OrganizationImportResolutionKind | null;
  allowedResolutions: OrganizationImportResolutionKind[];
  raw: OrganizationImportIssue;
}

export interface ReviewTreeNode {
  id: string;
  name: string;
  typeName: string;
  businessCode: string;
  parentId: string | null;
  isNew: boolean;
  isPlaceholder: boolean;
  placeholderKind?: "root" | "unplaced";
}

export interface ReviewTreeModel {
  byId: Map<string, ReviewTreeNode>;
  childrenByParent: Map<string | null, string[]>;
  depthById: Map<string, number>;
  parentById: Map<string, string | null>;
  pathById: Map<string, string[]>;
  roots: string[];
}

export interface ReviewVisibleRow {
  node: ReviewTreeNode;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

const SEVERITY_RANK: Record<OrganizationImportIssueSeverity, number> = { Blocker: 0, Warning: 1 };

/** True while the file has several top-level units and needs one organization above them. */
export function rootRequired(review: OrganizationImportReview): boolean {
  return review.issues.some((issue) => issue.code === "MultipleRoots");
}

/** The server's issues, keyed for selection and pointed at tree ids. Blockers first. */
export function deriveReviewIssues(review: OrganizationImportReview): ReviewIssue[] {
  return review.issues
    .map((issue, index) => {
      const nodeIds =
        issue.code === "MultipleRoots"
          ? [PLACEHOLDER_ROOT_ID]
          : [issue.proposalNodeId, ...issue.relatedNodeIds].filter((id): id is string => Boolean(id));
      return {
        key: `${issue.code}:${issue.proposalNodeId ?? issue.relatedNodeIds.join(",")}:${index}`,
        code: issue.code,
        severity: issue.severity,
        title: issue.title,
        detail: issue.message,
        nodeIds,
        anchorNodeId: issue.proposalNodeId ?? undefined,
        preferredResolution: issue.preferredResolution,
        allowedResolutions: issue.allowedResolutions,
        raw: issue,
      };
    })
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/**
 * Map each tree node to the strongest attention it carries, so the hierarchy can mark what needs a
 * decision without becoming warning soup.
 */
export function attentionByNode(issues: ReviewIssue[]): Map<string, OrganizationImportIssueSeverity> {
  const attention = new Map<string, OrganizationImportIssueSeverity>();
  for (const issue of issues) {
    for (const nodeId of issue.nodeIds) {
      const current = attention.get(nodeId);
      if (current === undefined || SEVERITY_RANK[issue.severity] < SEVERITY_RANK[current])
        attention.set(nodeId, issue.severity);
    }
  }
  return attention;
}

/**
 * The resulting hierarchy from the flat projection: proposed units, plus the existing units they
 * hang from. A unit whose parent reference didn't resolve sits in a visible "unplaced" group, and a
 * file with several tops shows the organization root it still needs.
 */
export function buildReviewTree(review: OrganizationImportReview): ReviewTreeModel {
  const unplaced = new Set(
    review.issues
      .filter((issue) => issue.code === "MissingParent" && issue.proposalNodeId)
      .map((issue) => issue.proposalNodeId!)
  );
  const nodeByExisting = new Map(
    review.nodes
      .filter((node) => node.existingOrgUnitId && node.classification === "Existing")
      .map((node) => [node.existingOrgUnitId!, node.proposalNodeId])
  );
  const existingParent = (unitId: string | null) =>
    unitId ? (nodeByExisting.get(unitId) ?? anchorTreeId(unitId)) : null;

  const nodes: ReviewTreeNode[] = [
    ...review.anchors.map((anchor) => ({
      id: anchorTreeId(anchor.id),
      name: anchor.name,
      typeName: anchor.typeName ?? "",
      businessCode: anchor.businessCode,
      parentId: existingParent(anchor.parentId),
      isNew: false,
      isPlaceholder: false,
    })),
    // Siblings read in the order the file lists them, not by internal id.
    ...[...review.nodes].sort((a, b) => sourceOrder(a) - sourceOrder(b)).map((node) => ({
      id: node.proposalNodeId,
      name: node.name,
      typeName: node.typeName ?? "",
      businessCode: node.businessCode,
      parentId: unplaced.has(node.proposalNodeId)
        ? UNPLACED_PARENT_ID
        : (node.parentProposalNodeId ?? existingParent(node.parentExistingUnitId)),
      isNew: node.classification === "Create",
      isPlaceholder: false,
    })),
  ];

  if (unplaced.size > 0)
    nodes.push({
      id: UNPLACED_PARENT_ID,
      name: "Unresolved placement",
      typeName: "",
      businessCode: "",
      parentId: null,
      isNew: false,
      isPlaceholder: true,
      placeholderKind: "unplaced",
    });

  if (rootRequired(review)) {
    for (const node of nodes)
      if (node.parentId === null && node.id !== UNPLACED_PARENT_ID) node.parentId = PLACEHOLDER_ROOT_ID;
    nodes.unshift({
      id: PLACEHOLDER_ROOT_ID,
      name: "Organization root",
      typeName: "Organization",
      businessCode: "",
      parentId: null,
      isNew: true,
      isPlaceholder: true,
      placeholderKind: "root",
    });
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string | null, string[]>();
  const parentById = new Map<string, string | null>();
  for (const node of nodes) {
    // A parent outside the tree (for example, a loop the validator reports) shows at the top level.
    const parentId = node.parentId && byId.has(node.parentId) ? node.parentId : null;
    parentById.set(node.id, parentId);
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(node.id);
    childrenByParent.set(parentId, siblings);
  }

  const depthById = new Map<string, number>();
  const pathById = new Map<string, string[]>();
  const roots = (childrenByParent.get(null) ?? []).slice();
  const walk = (id: string, depth: number, ancestors: string[]) => {
    if (depthById.has(id)) return;
    depthById.set(id, depth);
    pathById.set(id, [...ancestors, id]);
    for (const childId of childrenByParent.get(id) ?? []) walk(childId, depth + 1, [...ancestors, id]);
  };
  for (const rootId of roots) walk(rootId, 0, []);
  // Units caught in a parent loop are unreachable from any top; list them at the top level so they
  // stay visible next to the cycle issue.
  for (const node of nodes)
    if (!depthById.has(node.id)) {
      roots.push(node.id);
      walk(node.id, 0, []);
    }

  return { byId, childrenByParent, depthById, parentById, pathById, roots };
}

/**
 * The rows to render. With `visible` (a search result), only those ids show and every shown
 * branch is open; otherwise the administrator's collapsed set applies.
 */
function sourceOrder(node: OrganizationImportReviewNode): number {
  return node.sourceCells.length > 0 ? Math.min(...node.sourceCells.map((cell) => cell.rowNumber)) : -1;
}

export function flattenReviewTree(
  model: ReviewTreeModel,
  collapsed: ReadonlySet<string>,
  visible?: ReadonlySet<string>
): ReviewVisibleRow[] {
  const rows: ReviewVisibleRow[] = [];
  const seen = new Set<string>();
  const append = (id: string) => {
    const node = model.byId.get(id);
    if (!node || seen.has(id) || (visible && !visible.has(id))) return;
    seen.add(id);
    const children = (model.childrenByParent.get(id) ?? []).filter((child) => !visible || visible.has(child));
    const expanded = visible ? true : !collapsed.has(id);
    rows.push({ node, depth: model.depthById.get(id) ?? 0, hasChildren: children.length > 0, expanded });
    if (expanded) for (const childId of children) append(childId);
  };
  for (const rootId of model.roots) append(rootId);
  return rows;
}

export function findProposalNode(
  review: OrganizationImportReview,
  nodeId: string | null
): OrganizationImportReviewNode | null {
  if (!nodeId) return null;
  return review.nodes.find((node) => node.proposalNodeId === nodeId) ?? null;
}

/** Units whose name or business code contains the query, plus their ancestors so each match keeps its place. */
export function searchReviewTree(model: ReviewTreeModel, query: string): Set<string> | undefined {
  const needle = query.trim().toLowerCase();
  if (!needle) return undefined;
  const visible = new Set<string>();
  for (const node of model.byId.values()) {
    if (node.isPlaceholder) continue;
    if (!node.name.toLowerCase().includes(needle) && !node.businessCode.toLowerCase().includes(needle)) continue;
    for (const id of model.pathById.get(node.id) ?? [node.id]) visible.add(id);
  }
  return visible;
}

/** Every node that has children: the collapsed set for "Collapse all". */
export function branchIds(model: ReviewTreeModel, minDepth = 0): Set<string> {
  const ids = new Set<string>();
  for (const [parent, children] of model.childrenByParent)
    if (parent && children.length > 0 && (model.depthById.get(parent) ?? 0) >= minDepth) ids.add(parent);
  return ids;
}
