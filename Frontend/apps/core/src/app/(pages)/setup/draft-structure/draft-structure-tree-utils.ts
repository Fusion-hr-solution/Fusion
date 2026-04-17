import type {
  DraftOrgUnitTreeNodeDto,
  DraftStructureImportPreviewRowDto,
  DraftStructureImportValidationIssueDto,
} from "@repo/api";

export interface DraftStructureTreeIssue {
  code: string;
  field: string | null;
  message: string;
  rowNumber: number | null;
  severity: string;
}

export interface DraftStructureTreeIssueSummary {
  errorCount: number;
  warningCount: number;
  issues: DraftStructureTreeIssue[];
}

export interface DraftStructureTreeNodeModel {
  id: string;
  referenceKey: string;
  displayName: string;
  orgUnitKindKey: string;
  orgUnitKindLabel: string;
  parentReferenceKey: string | null;
  businessCode: string | null;
  description: string | null;
  attributes: Record<string, unknown>;
  level: number;
  rowNumber: number | null;
  isOrphaned: boolean;
  issueSummary: DraftStructureTreeIssueSummary;
  children: DraftStructureTreeNodeModel[];
}

export function buildWorkspaceDraftTree(
  nodes: DraftOrgUnitTreeNodeDto[]
): DraftStructureTreeNodeModel[] {
  return sortTreeNodes(
    nodes.map((node) => mapWorkspaceNode(node, null, 0))
  );
}

export function buildImportPreviewDraftTree(
  previewRows: DraftStructureImportPreviewRowDto[],
  validationIssues: DraftStructureImportValidationIssueDto[]
): DraftStructureTreeNodeModel[] {
  const issueLookup = new Map<number, DraftStructureTreeIssue[]>();

  for (const validationIssue of validationIssues) {
    const issues = issueLookup.get(validationIssue.rowNumber) ?? [];
    issues.push({
      code: validationIssue.code,
      field: validationIssue.field,
      message: validationIssue.message,
      rowNumber: validationIssue.rowNumber,
      severity: validationIssue.severity,
    });
    issueLookup.set(validationIssue.rowNumber, issues);
  }

  const nodesByReferenceKey = new Map<string, DraftStructureTreeNodeModel>();

  for (const previewRow of previewRows) {
    nodesByReferenceKey.set(normalizeReferenceKey(previewRow.referenceKey), {
      id: String(previewRow.rowNumber),
      referenceKey: previewRow.referenceKey,
      displayName: previewRow.displayName,
      orgUnitKindKey: previewRow.orgUnitKindKey,
      orgUnitKindLabel: previewRow.orgUnitKindLabel,
      parentReferenceKey: previewRow.parentReferenceKey,
      businessCode: previewRow.businessCode,
      description: previewRow.description,
      attributes: previewRow.attributes,
      level: 0,
      rowNumber: previewRow.rowNumber,
      isOrphaned: false,
      issueSummary: createIssueSummary(issueLookup.get(previewRow.rowNumber) ?? []),
      children: [],
    });
  }

  const roots: DraftStructureTreeNodeModel[] = [];

  for (const node of nodesByReferenceKey.values()) {
    const normalizedParentReferenceKey = normalizeNullableReferenceKey(
      node.parentReferenceKey
    );

    if (!normalizedParentReferenceKey) {
      roots.push(node);
      continue;
    }

    const parentNode = nodesByReferenceKey.get(normalizedParentReferenceKey);
    if (!parentNode) {
      node.isOrphaned = true;
      roots.push(node);
      continue;
    }

    parentNode.children.push(node);
  }

  return assignLevels(sortTreeNodes(roots), 0);
}

export function filterDraftTree(
  nodes: DraftStructureTreeNodeModel[],
  searchTerm: string
): DraftStructureTreeNodeModel[] {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  if (!normalizedSearchTerm) {
    return nodes;
  }

  return nodes.flatMap((node) => {
    const filteredChildren = filterDraftTree(node.children, normalizedSearchTerm);
    const matchesNode = [
      node.referenceKey,
      node.displayName,
      node.orgUnitKindLabel,
      node.businessCode ?? "",
      node.description ?? "",
      ...node.issueSummary.issues.map((issue) => issue.message),
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearchTerm);

    if (!matchesNode && filteredChildren.length === 0) {
      return [];
    }

    return [
      {
        ...node,
        children: filteredChildren,
      },
    ];
  });
}

export function findDraftTreeNodeById(
  nodes: DraftStructureTreeNodeModel[],
  id: string | null
): DraftStructureTreeNodeModel | null {
  if (!id) {
    return null;
  }

  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }

    const childMatch = findDraftTreeNodeById(node.children, id);
    if (childMatch) {
      return childMatch;
    }
  }

  return null;
}

export function getFirstDraftTreeNodeId(
  nodes: DraftStructureTreeNodeModel[]
): string | null {
  return nodes[0]?.id ?? null;
}

export function countDraftTreeNodes(nodes: DraftStructureTreeNodeModel[]): number {
  return nodes.reduce(
    (total, node) => total + 1 + countDraftTreeNodes(node.children),
    0
  );
}

function mapWorkspaceNode(
  node: DraftOrgUnitTreeNodeDto,
  parentReferenceKey: string | null,
  level: number
): DraftStructureTreeNodeModel {
  return {
    id: node.id,
    referenceKey: node.referenceKey,
    displayName: node.displayName,
    orgUnitKindKey: node.orgUnitKindKey,
    orgUnitKindLabel: node.orgUnitKindLabel,
    parentReferenceKey,
    businessCode: node.businessCode,
    description: null,
    attributes: {},
    level,
    rowNumber: null,
    isOrphaned: node.isOrphaned,
    issueSummary: createIssueSummary([]),
    children: sortTreeNodes(
      node.children.map((child) =>
        mapWorkspaceNode(child, node.referenceKey, level + 1)
      )
    ),
  };
}

function assignLevels(
  nodes: DraftStructureTreeNodeModel[],
  level: number
): DraftStructureTreeNodeModel[] {
  return nodes.map((node) => ({
    ...node,
    level,
    children: assignLevels(sortTreeNodes(node.children), level + 1),
  }));
}

function sortTreeNodes(
  nodes: DraftStructureTreeNodeModel[]
): DraftStructureTreeNodeModel[] {
  return [...nodes].sort((left, right) => {
    const displayNameResult = left.displayName.localeCompare(
      right.displayName,
      undefined,
      { sensitivity: "base" }
    );

    if (displayNameResult !== 0) {
      return displayNameResult;
    }

    return left.referenceKey.localeCompare(right.referenceKey, undefined, {
      sensitivity: "base",
    });
  });
}

function createIssueSummary(
  issues: DraftStructureTreeIssue[]
): DraftStructureTreeIssueSummary {
  return {
    errorCount: issues.filter((issue) => issue.severity === "error").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
    issues,
  };
}

function normalizeNullableReferenceKey(value: string | null): string | null {
  return value ? normalizeReferenceKey(value) : null;
}

function normalizeReferenceKey(value: string): string {
  return value.trim().toUpperCase();
}