import type { MeasurementMethod, PlanLifecycleState } from "@repo/api";

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
