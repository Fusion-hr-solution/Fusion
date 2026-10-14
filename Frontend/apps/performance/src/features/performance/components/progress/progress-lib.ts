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
