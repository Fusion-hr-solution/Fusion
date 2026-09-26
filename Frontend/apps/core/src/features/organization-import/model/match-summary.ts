import type { OrganizationImportMatch, OrganizationImportShape } from "@repo/api";

const SHAPE_LABEL: Record<OrganizationImportShape, string> = {
  Native: "Fusion template",
  ParentReference: "Parent-referenced",
  LevelColumns: "Level columns",
  Unresolved: "Not recognised",
};

export type MatchSummary = {
  shapeLabel: string;
  shapeResolved: boolean;
  typesTotal: number;
  typesResolved: number;
  needsReview: number;
};

export function summarizeMatch(match: OrganizationImportMatch): MatchSummary {
  const plan = match.mappingPlan;
  const decisions = match.readiness.requiredDecisions;
  const types = plan.typeMappingDetails ?? [];
  const unresolvedTypes = new Set(
    decisions.filter((d) => d.kind === "TypeMapping").map((d) => d.sourceValue ?? "")
  );
  return {
    shapeLabel: SHAPE_LABEL[plan.sourceShape],
    shapeResolved: plan.sourceShape !== "Unresolved",
    typesTotal: types.length,
    typesResolved: types.filter((t) => !unresolvedTypes.has(t.sourceValue)).length,
    needsReview: decisions.length,
  };
}
