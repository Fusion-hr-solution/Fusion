import type { MeasurementMethod, PlanLifecycleState, PlanReadinessDto } from "@repo/api";

export const PLAN_STATE_LABEL: Record<PlanLifecycleState, string> = {
  Draft: "Draft",
  Submitted: "Awaiting decision",
  Approved: "Approved",
};

export const PLAN_STATE_TONE: Record<PlanLifecycleState, "muted" | "warning" | "success"> = {
  Draft: "muted",
  Submitted: "warning",
  Approved: "success",
};

export const MEASUREMENT_METHOD_LABEL: Record<MeasurementMethod, string> = {
  ManualPercentage: "Manual percentage",
  NumericTarget: "Numeric target",
  WeightedMilestones: "Weighted milestones",
};

/** The tone for a running weight total against the 100% target. */
export function weightTone(total: number): "success" | "warning" | "danger" {
  if (total === 100) return "success";
  if (total > 100) return "danger";
  return "warning";
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

/** Two-decimal-trimmed percent for display (60 → "60", 33.33 → "33.33"). */
export function pct(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * One submission condition, derived from the plan's real readiness facts — never a hard-coded list.
 * `passed` mirrors the server's own submission gate so the checks card and the Submit button always
 * agree; `detail` carries the actionable statement shown when the condition fails.
 */
export interface PlanCheck {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
}

/**
 * The plan's submission conditions, one per rule the backend actually evaluates in `BuildReadiness`.
 * The weight-allocation and standalone-permission conditions only apply once they can be judged
 * (an objective exists / a standalone objective is present), so the list stays truthful rather than
 * padding to a fixed count. The passed subset drives the "N checks passed" collapsed summary; the
 * failed subset — leading — drives the actionable state.
 */
export function planChecks(readiness: PlanReadinessDto): PlanCheck[] {
  const hasObjectives = readiness.objectiveCount > 0;
  const remaining = readiness.weightRemaining;
  const checks: PlanCheck[] = [
    {
      id: "objective",
      label: "Plan has at least one objective",
      passed: hasObjectives,
      detail: "Add an objective to your plan",
    },
    {
      id: "weight-assigned",
      label: "Every objective carries a weight",
      passed: hasObjectives && readiness.everyObjectiveHasWeight,
      detail: "Give every objective a weight above zero",
    },
    {
      id: "weight-total",
      label: "Weights total 100%",
      passed: hasObjectives && readiness.weightTotal === 100,
      detail:
        remaining > 0
          ? `${pct(remaining)}% of plan weight is still to assign`
          : remaining < 0
            ? `Plan weight is over by ${pct(-remaining)}%`
            : "Weights total 100%",
    },
    {
      id: "direction",
      label: "At least one objective supports strategic direction",
      passed: hasObjectives && readiness.connectsToStrategicDirection,
      detail: "Align at least one objective to organizational direction",
    },
  ];
  // Standalone permission is a policy fact, not a condition every plan must pass — it only becomes a
  // submission gate when the plan actually holds a standalone objective the policy forbids. Surfaced
  // only then, and only as a failed check, so it never masquerades as a passed requirement.
  if (readiness.hasStandaloneObjective && !readiness.standaloneAllowed) {
    checks.push({
      id: "standalone",
      label: "Align every objective — standalone objectives are not permitted this cycle",
      passed: false,
      detail: "Standalone objectives are not permitted — align every objective",
    });
  }
  return checks;
}
