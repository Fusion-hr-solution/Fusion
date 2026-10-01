/**
 * The value dial's domain. The dial works in integer *positions* along the direction of progress, so a
 * decreasing target (5 → 1 days) and an increasing one (42 → 70%) read the same way: left is the baseline,
 * right is the target and beyond. Positions map back to real values on a "nice" step.
 */
export interface DialDomain {
  /** Real value at each position: `valueAt(pos)`. */
  valueAt: (pos: number) => number;
  /** Nearest position for a real value (clamped into the domain). */
  positionOf: (value: number) => number;
  /** Last position (positions run 0..max). */
  max: number;
  /** Size of one position in real units, always positive. */
  step: number;
  /** Position of the baseline (0, unless the reported value already sits behind it). */
  baselinePos: number;
  /** Position of the target; null when there is no target (manual percentage ends at 100). */
  targetPos: number | null;
}

const NICE = [1, 2, 2.5, 5];

/** Smallest 1/2/2.5/5 × 10^k at or above `raw`. */
export function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const exp = Math.floor(Math.log10(raw));
  for (let e = exp; e <= exp + 1; e++) {
    for (const n of NICE) {
      const candidate = n * 10 ** e;
      if (candidate >= raw - 1e-12) return candidate;
    }
  }
  return 10 ** (exp + 1);
}

function decimalsOf(step: number): number {
  const s = String(step);
  return s.split(".")[1]?.length ?? 0;
}

/** Round to the step's precision so 0.1 + 0.2 never shows as 0.30000000000000004. */
export function roundTo(value: number, step: number): number {
  const d = decimalsOf(step);
  return Number(value.toFixed(d));
}

/** Manual completion: 0..100 in whole percents. */
export function percentDomain(): DialDomain {
  return {
    valueAt: (pos) => pos,
    positionOf: (value) => Math.max(0, Math.min(100, Math.round(value))),
    max: 100,
    step: 1,
    baselinePos: 0,
    targetPos: null,
  };
}

/**
 * Numeric target: baseline → target, plus a short overachievement run past the target (actuals may
 * exceed it — derived progress goes above 100%). A reported value outside that range widens it so the
 * dial never misrepresents the truth. Non-negative scales never go below 0; a "%" unit stays within 0..100.
 * Returns null when the scale is degenerate (no span), so the caller can fall back to plain entry.
 */
export function numericDomain(
  baseline: number,
  target: number,
  unit: string | null,
  reported: number | null
): DialDomain | null {
  const span = Math.abs(target - baseline);
  if (!(span > 0) || !Number.isFinite(span)) return null;
  const dir = target > baseline ? 1 : -1;

  // The scale, not the last report, sets the step; an off-grid report still shows exactly at rest.
  const integral = Number.isInteger(baseline) && Number.isInteger(target);
  const raw = span / 100;
  // Whole-number scales step by whole units — except short ones (5 → 1 days), where halves are real values.
  const step = integral ? (span < 10 ? 0.5 : Math.max(1, niceStep(raw))) : niceStep(raw);

  // Distance along the direction of progress: 0 at baseline, `span` at target.
  const along = (value: number) => (value - baseline) * dir;
  const valueAtAlong = (a: number) => baseline + dir * a;

  let lo = 0;
  let hi = span + Math.max(step, span * 0.2);
  if (reported != null && Number.isFinite(reported)) {
    lo = Math.min(lo, along(reported));
    hi = Math.max(hi, along(reported));
  }

  // Physical floors/ceilings on the real scale.
  const nonNegative = baseline >= 0 && target >= 0 && (reported == null || reported >= 0);
  const bounds: [number, number] = unit === "%" ? [0, 100] : nonNegative ? [0, Infinity] : [-Infinity, Infinity];
  const clampAlong = (a: number) => {
    const v = valueAtAlong(a);
    const clamped = Math.max(bounds[0], Math.min(bounds[1], v));
    return along(clamped);
  };
  lo = Math.min(0, clampAlong(lo));
  hi = Math.max(span, clampAlong(hi));

  // Snap the ends onto the step grid around the baseline so baseline and target land on positions.
  const loSteps = Math.floor(lo / step + 1e-9);
  const hiSteps = Math.ceil(hi / step - 1e-9);
  const max = hiSteps - loSteps;
  const startAlong = loSteps * step;

  const valueAt = (pos: number) => roundTo(valueAtAlong(startAlong + Math.max(0, Math.min(max, pos)) * step), step);
  const positionOf = (value: number) => Math.max(0, Math.min(max, Math.round((along(value) - startAlong) / step)));

  return {
    valueAt,
    positionOf,
    max,
    step,
    baselinePos: positionOf(baseline),
    targetPos: positionOf(target),
  };
}
