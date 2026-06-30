import type { StatusTone } from "@repo/ds/shell";

// ── Weight helpers ───────────────────────────────────────────────────────────

export function parseWeightValues(csv: string): number[] {
  return csv
    .split(",")
    .map((w) => parseInt(w.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);
}

export function formatWeightValues(values: number[]): string {
  return values.join(",");
}

// ── Measurement type helpers ─────────────────────────────────────────────────

export type MeasurementSet = { numeric: boolean; qualitative: boolean };

export function parseMeasurementTypes(csv: string): MeasurementSet {
  const parts = csv.split(",").map((s) => s.trim());
  return {
    numeric: parts.includes("Quantitative"),
    qualitative: parts.includes("Qualitative"),
  };
}

export function formatMeasurementTypes(set: MeasurementSet): string {
  const parts: string[] = [];
  if (set.numeric) parts.push("Quantitative");
  if (set.qualitative) parts.push("Qualitative");
  return parts.join(",");
}

export function labelMeasurementTypes(csv: string): string {
  const set = parseMeasurementTypes(csv);
  if (set.numeric && set.qualitative) return "Numeric targets & qualitative outcomes";
  if (set.numeric) return "Numeric targets only";
  if (set.qualitative) return "Qualitative outcomes only";
  return "—";
}

// Single-template measurement type
export function labelMeasurementType(type: string): string {
  if (type === "Quantitative") return "Numeric target";
  if (type === "Qualitative") return "Qualitative outcome";
  return type;
}

// ── Cascade/alignment helpers ────────────────────────────────────────────────

export function labelCascadeMode(mode: string): string {
  if (mode === "Disabled") return "Not used";
  if (mode === "Optional") return "Optional";
  if (mode === "Required") return "Required";
  return mode;
}

// ── Status helpers ───────────────────────────────────────────────────────────

/** Policy version statuses */
export function policyStatusLabel(status: string): string {
  if (status === "Active") return "Current policy";
  if (status === "Draft") return "Unpublished changes";
  if (status === "Superseded") return "Previous version";
  return status;
}

export function policyStatusTone(status: string): StatusTone {
  if (status === "Active") return "success";
  if (status === "Draft") return "warning";
  if (status === "Superseded") return "muted";
  return "neutral";
}

/** Template statuses */
export function templateStatusLabel(status: string, hasDraft: boolean): string {
  if (hasDraft && status === "Active") return "Changes pending";
  if (status === "Active") return "Active";
  if (status === "Draft") return "Draft";
  if (status === "Archived") return "Archived";
  return status;
}

export function templateStatusTone(status: string, hasDraft: boolean): StatusTone {
  if (hasDraft && status === "Active") return "warning";
  if (status === "Active") return "success";
  if (status === "Draft") return "warning";
  if (status === "Archived") return "muted";
  return "neutral";
}

/** Baseline/platform statuses */
export function baselineStatusLabel(status: string): string {
  if (status === "Published") return "Published";
  if (status === "Draft") return "Unpublished changes";
  if (status === "Superseded") return "Previous version";
  return status;
}

export function baselineStatusTone(status: string): StatusTone {
  if (status === "Published") return "success";
  if (status === "Draft") return "warning";
  if (status === "Superseded") return "muted";
  return "neutral";
}

// ── Applicability validation state ───────────────────────────────────────────

export function applicabilityValidationLabel(state: string): string {
  if (state === "Valid") return "Audience looks good";
  if (state === "HasUnresolved") return "A selected organisation value is no longer available";
  return "";
}

export function applicabilityValidationTone(state: string): StatusTone {
  if (state === "Valid") return "success";
  if (state === "HasUnresolved") return "warning";
  return "neutral";
}

// ── Date formatting ──────────────────────────────────────────────────────────

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
}
