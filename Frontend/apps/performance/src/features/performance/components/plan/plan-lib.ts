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

/**
 * Weight/allocation percent — an authored figure that lives in whole percents, so it renders exactly
 * (60 → "60") and only ever carries decimals if data upstream does (33.33 → "33.33").
 */
export function pct(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

/** A raw measurement value with its optional unit suffix ("45%", "12 days"); an em dash when unset. */
export function formatMeasureValue(value: number | null, unit: string | null): string {
  if (value === null) return "—";
  return unit ? `${value}${unit}` : String(value);
}

/**
 * Derived objective/plan progress for normal display — always a whole percent. Progress is computed and
 * rolled up at full precision (the raw measurement value carries its own precision elsewhere), but the
 * rows, bars and donuts read as whole percentages: "calculate precisely, display simply", so the HR UI
 * never shows floating-point noise like 66.6666667%.
 */
export function progressPct(value: number): string {
  return String(Math.round(value));
}

/**
 * Derived progress for a detail view, where a finer figure is genuinely useful — one decimal at most
 * (83.3%, never 83.333%). Trims the decimal when it rounds to a whole number so it stays clean.
 */
export function progressPctDetail(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/**
 * Non-judgmental progress colour. Fusion has no on-track/off-track health model, so the tone never
 * encodes "good" or "bad" — it echoes the objective's identity instead: a completed objective reads as
 * genuine success (green), an in-flight aligned objective carries the Fusion accent, and a standalone
 * objective keeps the same info blue its identity uses everywhere else.
 */
export type ProgressTone = "success" | "primary" | "info";

export function objectiveProgressTone(isAligned: boolean, derivedProgress: number): ProgressTone {
  if (derivedProgress >= 100) return "success";
  return isAligned ? "primary" : "info";
}

export const PROGRESS_TONE_VAR: Record<ProgressTone, string> = {
  success: "var(--success)",
  primary: "var(--primary)",
  info: "var(--info)",
};

export const PROGRESS_TONE_TEXT: Record<ProgressTone, string> = {
  success: "text-success",
  primary: "text-primary",
  info: "text-info",
};

export const PROGRESS_TONE_BG: Record<ProgressTone, string> = {
  success: "bg-success",
  primary: "bg-primary",
  info: "bg-info",
};

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
