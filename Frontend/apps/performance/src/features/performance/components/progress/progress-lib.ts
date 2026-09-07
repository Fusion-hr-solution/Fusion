import type { ProgressEventKind } from "@repo/api";

export function pct(value: number | null | undefined): string {
  if (value == null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * Derived/reported progress for normal display — always a whole percent. Progress rolls up at full
 * precision but reads simply: "calculate precisely, display simply", never floating-point noise.
 */
export function progressPct(value: number): string {
  return String(Math.round(value));
}

export function num(value: number | null | undefined): string {
  if (value == null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/\.?0+$/, "");
}

/** Derived progress for a numeric target from the current actual, honoring direction (may exceed 100). */
export function numericProgress(baseline: number, target: number, actual: number): number {
  const span = target - baseline;
  if (span === 0) return 0;
  const pctValue = ((actual - baseline) / span) * 100;
  return Math.max(0, Math.round(pctValue * 100) / 100);
}

/** Marker position 0..1 of an actual between baseline and target (clamped for display). */
export function markerFraction(baseline: number, target: number, actual: number): number {
  const span = target - baseline;
  if (span === 0) return 0;
  return Math.min(1, Math.max(0, (actual - baseline) / span));
}

export const PROGRESS_EVENT_LABEL: Record<ProgressEventKind, string> = {
  PercentageSet: "Updated completion",
  NumericActual: "Recorded a new value",
  MilestoneCompleted: "Completed a milestone",
  MilestoneReopened: "Reopened a milestone",
};

export function progressTone(value: number): string {
  if (value >= 100) return "text-success";
  if (value >= 60) return "text-foreground";
  return "text-foreground";
}
