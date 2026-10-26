import type { OrganizationImportMatch } from "@repo/api";
import { englishSay, type Say } from "@repo/ds/lib/say";
import { englishMessages } from "@/i18n/messages";

const ENGLISH = englishSay(englishMessages, "orgImport");

export type MatchSummary = {
  shapeLabel: string;
  shapeResolved: boolean;
  typesTotal: number;
  typesResolved: number;
  needsReview: number;
};

export function summarizeMatch(match: OrganizationImportMatch, say: Say = ENGLISH): MatchSummary {
  const plan = match.mappingPlan;
  const decisions = match.readiness.requiredDecisions;
  const types = plan.typeMappingDetails ?? [];
  const unresolvedTypes = new Set(
    decisions.filter((d) => d.kind === "TypeMapping").map((d) => d.sourceValue ?? "")
  );
  return {
    shapeLabel: say(`match.shape.${plan.sourceShape}`),
    shapeResolved: plan.sourceShape !== "Unresolved",
    typesTotal: types.length,
    typesResolved: types.filter((t) => !unresolvedTypes.has(t.sourceValue)).length,
    needsReview: decisions.length,
  };
}
