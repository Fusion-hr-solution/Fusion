import type { PlanLifecycleState, PlanReadinessDto } from "@repo/api";
import { formatNumber } from "@repo/ds/lib/numbers";
import { english, type Say } from "@/i18n/say";

export const PLAN_STATE_TONE: Record<PlanLifecycleState, "muted" | "warning" | "success"> = {
  Draft: "muted",
  Submitted: "warning",
  Approved: "success",
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

/** A measurement number on its own: grouped, float noise trimmed, compact from a million ("1.2m"). */
export function formatMeasureNumber(value: number): string {
  return Math.abs(value) >= 1_000_000
    ? formatNumber(value, { notation: "compact", maximumFractionDigits: 1 })
    : formatNumber(value, { maximumFractionDigits: 2 });
}

/** Symbol units hug the number (45%, $3, 2x, 5kg); anything wordier is a label read once, apart from it. */
export function isSymbolUnit(unit: string): boolean {
  const trimmed = unit.trim();
  return !/^\p{L}/u.test(trimmed) || trimmed.length <= 2;
}

/** A raw measurement value with its optional unit suffix ("45%", "12 days"); an em dash when unset. */
export function formatMeasureValue(value: number | null, unit: string | null): string {
  if (value === null) return "—";
  const number = formatMeasureNumber(value);
  const label = unit?.trim();
  if (!label) return number;
  if (label === "$" || label === "€" || label === "£") return `${label}${number}`;
  return !/^\p{L}/u.test(label) || label.length === 1 ? `${number}${label}` : `${number} ${label}`;
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

/** Submission conditions follow the cycle's captured policy; Optional has no alignment check. */
export function planChecks(readiness: PlanReadinessDto, say: Say = english("plan.checks")): PlanCheck[] {
  const hasObjectives = readiness.objectiveCount > 0;
  const remaining = readiness.weightRemaining;
  const checks: PlanCheck[] = [
    {
      id: "objective",
      label: say("objective.label"),
      passed: hasObjectives,
      detail: say("objective.detail"),
    },
    {
      id: "weight-assigned",
      label: say("weightAssigned.label"),
      passed: hasObjectives && readiness.everyObjectiveHasWeight,
      detail: say("weightAssigned.detail"),
    },
    {
      id: "weight-total",
      label: say("weightTotal.label"),
      passed: hasObjectives && readiness.weightTotal === 100,
      detail:
        remaining > 0
          ? say("weightTotal.remaining", { remaining: pct(remaining) })
          : remaining < 0
            ? say("weightTotal.over", { over: pct(-remaining) })
            : say("weightTotal.label"),
    },
  ];
  if (readiness.openChangeRequests > 0) {
    checks.push({
      id: "change-requests",
      label: "Every change request is addressed",
      passed: false,
      detail:
        readiness.openChangeRequests === 1
          ? "Address 1 change request"
          : `Address ${readiness.openChangeRequests} change requests`,
    });
  }
  if (readiness.alignmentPolicy !== "Optional") {
    const every = readiness.alignmentPolicy === "EveryObjectiveConnected";
    checks.push({
      id: "direction",
      label: every ? "Every objective supports strategic direction" : "At least one objective supports strategic direction",
      passed: hasObjectives && (every ? readiness.everyObjectiveConnectsToStrategicDirection : readiness.connectsToStrategicDirection),
      detail: every ? "Align every objective to strategic direction" : "Align at least one objective to strategic direction",
    });
  }
  return checks;
}
