import type {
  OrganizationHierarchyNodeDto,
  OrgUnitSelectionInput,
  PopulationCandidateDto,
  ReadinessIssueDto,
  PopulationSelectionDto,
  SetPopulationRequest,
} from "@repo/api";

// ── Candidate view model ─────────────────────────────────────────────────────

export type CandidateStatus = "ready" | "attention" | "excluded";

export function candidateStatus(
  candidate: PopulationCandidateDto
): CandidateStatus {
  if (candidate.isExcluded) return "excluded";
  if (!candidate.isEligible) return "attention";
  return "ready";
}

/** Bulk exclusion only applies to people who are still in the resolved population. */
export function isBulkSelectable(candidate: PopulationCandidateDto): boolean {
  return !candidate.isExcluded;
}

export type ReviewerView =
  | { kind: "resolved"; name: string }
  | { kind: "inactive"; name: string }
  | { kind: "unresolved" };

/** How a candidate's reviewer should read: a valid active manager, an inactive one, or none. */
export function reviewerView(candidate: PopulationCandidateDto): ReviewerView {
  if (!candidate.managerDisplayName) return { kind: "unresolved" };
  if (!candidate.managerIsActive)
    return { kind: "inactive", name: candidate.managerDisplayName };
  return { kind: "resolved", name: candidate.managerDisplayName };
}

/** The issue to name on a blocked candidate — reviewer problems rank ahead of the rest. */
export function primaryIssue(
  candidate: PopulationCandidateDto
): ReadinessIssueDto | null {
  const hard = candidate.issues.filter((issue) => issue.isHard);
  const reviewer = hard.find(
    (issue) =>
      issue.code === "MissingManager" || issue.code === "InactiveManager"
  );
  return reviewer ?? hard[0] ?? candidate.issues[0] ?? null;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Rebuilds the wholesale selection request from the current selection (the server replaces it). */
export function selectionToRequest(
  selection: PopulationSelectionDto
): SetPopulationRequest {
  return {
    mode: selection.mode,
    orgUnitSelections: selection.orgUnitSelections,
    inclusions: selection.inclusions,
    exclusions: selection.exclusions,
  };
}

// ── Organization tree state ──────────────────────────────────────────────────

export interface OrgSelectionState {
  /** Explicitly chosen. */
  selected: boolean;
  /** Covered because a selected ancestor includes its descendants. */
  inherited: boolean;
  /** Not itself covered, but some descendant is selected. */
  indeterminate: boolean;
  /** When explicitly chosen, whether this unit also pulls in everyone below it. */
  includeDescendants: boolean;
}

/**
 * Derives per-unit selection state for the org tree. Each chosen unit independently decides whether
 * it pulls in its sub-units (the backend carries `includeDescendants` per selection), so coverage is
 * resolved unit-by-unit: a chosen unit that includes descendants marks its subtree "inherited"; a
 * unit with only some descendants covered reads "indeterminate". This mirrors the actual selection
 * the server resolves against, so the tree's tri-state affordance never lies about the outcome.
 */
export function computeOrgStates(
  roots: OrganizationHierarchyNodeDto[],
  selections: OrgUnitSelectionInput[]
): Map<string, OrgSelectionState> {
  const chosen = new Map(
    selections.map((selection) => [
      selection.orgUnitId,
      selection.includeDescendants,
    ])
  );
  const map = new Map<string, OrgSelectionState>();
  const walk = (
    node: OrganizationHierarchyNodeDto,
    ancestorCovered: boolean
  ): boolean => {
    const selected = chosen.has(node.unit.id);
    const includeDescendants = chosen.get(node.unit.id) === true;
    const inherited = ancestorCovered && !selected;
    const childCovered = ancestorCovered || (selected && includeDescendants);
    let descendantSelected = false;
    for (const child of node.children) {
      if (walk(child, childCovered)) descendantSelected = true;
    }
    const indeterminate = !selected && !inherited && descendantSelected;
    map.set(node.unit.id, {
      selected,
      inherited,
      indeterminate,
      includeDescendants,
    });
    return selected || descendantSelected;
  };
  for (const root of roots) walk(root, false);
  return map;
}
