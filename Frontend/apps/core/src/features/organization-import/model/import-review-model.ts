import type {
  OrganizationImportIssue,
  OrganizationImportIssueSeverity,
  OrganizationImportReview,
  OrganizationImportReviewNode,
  OrganizationImportResultNode,
} from "@repo/api";

// The synthetic node that stands in for the one Organization root a fresh tenant
// must supply. It lives only in the review tree so the missing root is visible
// in the hierarchy itself rather than announced as a detached blocker.
export const PLACEHOLDER_ROOT_ID = "__organization_root_required__";

// The synthetic grouping node that holds proposed units whose source parent could
// not be matched, so they are shown honestly as unplaced rather than silently
// dropped beneath the canonical root Fusion never actually resolved them to.
export const UNPLACED_PARENT_ID = "__unresolved_placement__";

export type ReviewSelection =
  | { kind: "none" }
  | { kind: "unit"; nodeId: string }
  | { kind: "suggestions" }
  | { kind: "issues" }
  | { kind: "issue"; key: string };

export type ReviewIssueKind =
  | "root"
  | "type"
  | "identity"
  | "difference"
  | "sourceMapping"
  | "descriptive"
  | "parent"
  | "unit"
  | "generic";

export interface ReviewIssue {
  key: string;
  kind: ReviewIssueKind;
  severity: OrganizationImportIssueSeverity;
  title: string;
  detail: string;
  /** Result-tree node ids to highlight; empty when the issue has no tree anchor. */
  nodeIds: string[];
  /** Proposal node id whose inspector resolves the issue, when unit-anchored. */
  anchorNodeId?: string;
  rawType?: string;
  raw?: OrganizationImportIssue;
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

const SEVERITY_RANK: Record<OrganizationImportIssueSeverity, number> = {
  Blocker: 0,
  Warning: 1,
  Information: 2,
};

const ROOT_CONSEQUENCE_CODES = new Set(["RootCount", "RootType"]);
const UNIT_CORRECTION_CODES = new Set([
  "InvalidBusinessCode",
  "BusinessCodeUnavailable",
  "DuplicateProposalCode",
]);
const SOURCE_MAPPING_CODES = new Set([
  "UnsupportedShape",
  "MissingNameMapping",
  "LevelColumnsUnresolved",
]);
const REQUIRED_MAPPING_FIELDS = new Set(["name", "parentBusinessCode"]);

/** True while a fresh tenant still needs its one explicit Organization root. */
export function rootRequired(review: OrganizationImportReview): boolean {
  return review.issues.some((issue) => issue.code === "FreshRootRequired");
}

export function needsSourceMapping(review: OrganizationImportReview): boolean {
  if (review.shapeStatus === "Unresolved") return true;
  if (review.shape === "LevelColumns") return false;
  return review.fieldMappings.some(
    (mapping) =>
      mapping.status === "Unresolved" && REQUIRED_MAPPING_FIELDS.has(mapping.field)
  );
}

function unitCorrectionTitle(code: string, name: string): string {
  switch (code) {
    case "InvalidBusinessCode":
      return `Fix the business code for ${name}`;
    case "BusinessCodeUnavailable":
      return `${name}’s business code is taken`;
    case "DuplicateProposalCode":
      return `${name}’s business code is used twice`;
    default:
      return name;
  }
}

/**
 * Collapse the backend's root-cause issues into one user-facing list. A single
 * missing root becomes one issue; each unknown source type becomes one mapping
 * question; identity contradictions carry their evidence; the remainder stays
 * business-readable. Ordered blockers first.
 */
export function deriveReviewIssues(review: OrganizationImportReview): ReviewIssue[] {
  const proposalById = new Map(review.proposalNodes.map((node) => [node.id, node]));
  const nameOf = (id: string | undefined) =>
    (id ? proposalById.get(id)?.name : undefined) ?? "this unit";
  const hasFreshRoot = rootRequired(review);
  const issues: ReviewIssue[] = [];

  if (needsSourceMapping(review)) {
    issues.push({
      key: "sourceMapping",
      kind: "sourceMapping",
      severity: "Blocker",
      title: "Set up the source columns",
      detail: "Tell Fusion how to read this file before it can build the structure.",
      nodeIds: [],
    });
  }

  for (const issue of review.issues) {
    if (issue.code === "FreshRootRequired") {
      const names = issue.nodeIds.map((id) => proposalById.get(id)?.name).filter(Boolean) as string[];
      issues.push({
        key: "root",
        kind: "root",
        severity: issue.severity,
        title: "Organization root required",
        detail:
          names.length >= 2
            ? `${joinNames(names)} need one organization above them.`
            : "This structure needs one organization at the top.",
        nodeIds: [PLACEHOLDER_ROOT_ID],
        raw: issue,
      });
      continue;
    }
    if (hasFreshRoot && ROOT_CONSEQUENCE_CODES.has(issue.code)) continue;
    if (SOURCE_MAPPING_CODES.has(issue.code)) continue;

    if (issue.code === "UnknownType") {
      const rawType =
        issue.nodeIds.map((id) => proposalById.get(id)?.rawType).find(Boolean) ?? "";
      issues.push({
        key: `type:${rawType}`,
        kind: "type",
        severity: issue.severity,
        title: `Map “${rawType || "an unknown type"}” to an organization type`,
        detail: `${issue.affectedCount} proposed unit${issue.affectedCount === 1 ? "" : "s"}`,
        nodeIds: issue.nodeIds,
        rawType,
        raw: issue,
      });
      continue;
    }
    if (issue.code === "StrongIdentityContradiction") {
      const anchor = issue.nodeIds[0];
      issues.push({
        key: `identity:${anchor}`,
        kind: "identity",
        severity: issue.severity,
        title: `${nameOf(anchor)} matches two units`,
        detail: "The file’s identifiers point to two different existing units.",
        nodeIds: issue.nodeIds,
        anchorNodeId: anchor,
        raw: issue,
      });
      continue;
    }
    if (issue.code === "DescriptiveCandidate") {
      const anchor = issue.nodeIds[0];
      issues.push({
        key: `descriptive:${anchor}`,
        kind: "descriptive",
        severity: issue.severity,
        title: `${nameOf(anchor)} may already exist`,
        detail: "Confirm whether this is a new unit or an existing one.",
        nodeIds: issue.nodeIds,
        anchorNodeId: anchor,
        raw: issue,
      });
      continue;
    }
    if (issue.code === "UnsupportedExistingDifference" && issue.nodeIds.length) {
      const anchor = issue.nodeIds[0]!;
      issues.push({
        key: `difference:${anchor}`,
        kind: "difference",
        severity: issue.severity,
        title: `${nameOf(anchor)} already exists`,
        detail: "The file describes it differently.",
        nodeIds: issue.nodeIds,
        anchorNodeId: anchor,
        raw: issue,
      });
      continue;
    }
    if (issue.code === "ParentUnresolved" && issue.nodeIds.length) {
      const anchor = issue.nodeIds[0]!;
      const rawParent = proposalById.get(anchor)?.rawParent;
      issues.push({
        key: `parent:${anchor}`,
        kind: "parent",
        severity: issue.severity,
        title: `Place ${nameOf(anchor)}`,
        detail: rawParent
          ? `Source parent “${rawParent}” didn’t match a unit.`
          : "The source parent couldn’t be matched.",
        nodeIds: issue.nodeIds,
        anchorNodeId: anchor,
        raw: issue,
      });
      continue;
    }
    if (UNIT_CORRECTION_CODES.has(issue.code) && issue.nodeIds.length) {
      const anchor = issue.nodeIds[0];
      issues.push({
        key: `unit:${issue.code}:${anchor}`,
        kind: "unit",
        severity: issue.severity,
        title: unitCorrectionTitle(issue.code, nameOf(anchor)),
        detail: issue.message,
        nodeIds: issue.nodeIds,
        anchorNodeId: anchor,
        raw: issue,
      });
      continue;
    }
    issues.push({
      key: `generic:${issue.code}:${issues.length}`,
      kind: "generic",
      severity: issue.severity,
      title: issue.title,
      detail: issue.message,
      nodeIds: issue.nodeIds,
      anchorNodeId: issue.nodeIds[0],
      raw: issue,
    });
  }

  return issues.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/**
 * Map each result-tree node to the strongest attention it carries, so the
 * hierarchy can mark what needs a decision without becoming warning soup.
 */
export function attentionByNode(
  issues: ReviewIssue[]
): Map<string, OrganizationImportIssueSeverity> {
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

export function buildReviewTree(
  result: readonly OrganizationImportResultNode[],
  showPlaceholderRoot: boolean,
  unresolvedParentIds: ReadonlySet<string> = new Set()
): ReviewTreeModel {
  const nodes: ReviewTreeNode[] = result.map((node) => ({
    id: node.id,
    name: node.name,
    typeName: node.typeName,
    businessCode: node.businessCode,
    parentId: node.parentId,
    isNew: node.isNew,
    isPlaceholder: false,
  }));

  // Honest placement: a node whose source parent Fusion could not match is not
  // shown beneath the fallback root it was never resolved to. Group it under a
  // visible "unplaced" node so it stays reviewable without a false parentage.
  const unplaced = nodes.filter((node) => unresolvedParentIds.has(node.id));
  if (unplaced.length > 0) {
    for (const node of unplaced) node.parentId = UNPLACED_PARENT_ID;
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
  }

  if (showPlaceholderRoot) {
    const currentRoots = nodes.filter(
      (node) => node.parentId === null && node.id !== UNPLACED_PARENT_ID
    );
    for (const root of currentRoots) root.parentId = PLACEHOLDER_ROOT_ID;
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
    parentById.set(node.id, node.parentId);
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node.id);
    childrenByParent.set(node.parentId, siblings);
  }

  const depthById = new Map<string, number>();
  const pathById = new Map<string, string[]>();
  const roots = (childrenByParent.get(null) ?? []).slice();
  const walk = (id: string, depth: number, ancestors: string[]) => {
    depthById.set(id, depth);
    pathById.set(id, [...ancestors, id]);
    for (const childId of childrenByParent.get(id) ?? [])
      walk(childId, depth + 1, [...ancestors, id]);
  };
  for (const rootId of roots) walk(rootId, 0, []);

  return { byId, childrenByParent, depthById, parentById, pathById, roots };
}

export function flattenReviewTree(
  model: ReviewTreeModel,
  collapsed: ReadonlySet<string>
): ReviewVisibleRow[] {
  const rows: ReviewVisibleRow[] = [];
  const append = (id: string) => {
    const node = model.byId.get(id);
    if (!node) return;
    const children = model.childrenByParent.get(id) ?? [];
    const expanded = !collapsed.has(id);
    rows.push({
      node,
      depth: model.depthById.get(id) ?? 0,
      hasChildren: children.length > 0,
      expanded,
    });
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
  return review.proposalNodes.find((node) => node.id === nodeId) ?? null;
}

/** Result-tree node ids whose source parent could not be matched. */
export function unresolvedParentNodeIds(issues: ReviewIssue[]): Set<string> {
  const ids = new Set<string>();
  for (const issue of issues)
    if (issue.kind === "parent") for (const nodeId of issue.nodeIds) ids.add(nodeId);
  return ids;
}

/** Proposed (new) descendants of a node, so excluding a subtree is honest. */
export function proposedDescendantIds(
  result: readonly OrganizationImportResultNode[],
  nodeId: string
): string[] {
  const childrenByParent = new Map<string | null, OrganizationImportResultNode[]>();
  for (const node of result) {
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  }
  const descendants: string[] = [];
  const stack = [nodeId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const child of childrenByParent.get(current) ?? [])
      if (child.isNew) {
        descendants.push(child.id);
        stack.push(child.id);
      }
  }
  return descendants;
}


function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}
