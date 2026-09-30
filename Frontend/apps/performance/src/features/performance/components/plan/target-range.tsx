import { ArrowRight, TrendingDown, TrendingUp } from "@/lib/icons";
import { formatMeasureValue } from "./plan-lib";

/**
 * Baseline → target for a numeric measure. The connector carries the improvement direction itself (a
 * rising or falling trend instead of a plain arrow), so the row never has to spell out "Increase".
 */
export function TargetRange({
  baseline,
  target,
  unit,
  direction,
}: {
  baseline: number | null;
  target: number | null;
  unit: string | null;
  direction?: "Increase" | "Decrease" | null;
}) {
  const Icon = direction === "Decrease" ? TrendingDown : direction === "Increase" ? TrendingUp : ArrowRight;
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      {formatMeasureValue(baseline, unit)}
      <Icon className="size-4.5 text-[var(--type-accent,var(--primary))]" aria-hidden />
      {direction ? <span className="sr-only">{direction === "Decrease" ? "decrease to" : "increase to"}</span> : null}
      {formatMeasureValue(target, unit)}
    </span>
  );
}
