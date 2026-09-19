import { cn } from "@repo/ds/lib/utils";
import { formatDate } from "@/features/performance/lib";

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * A proportional read of the cycle's shape: where the planning deadline falls between start and
 * end. Pure structure — it shows the timeline rather than describing it, and updates live as the
 * dates change. The planning-deadline marker is pinned above the track so its label never collides
 * with the start/end labels, however close the dates sit.
 */
export function CycleTimeline({
  startDate,
  endDate,
  planningDeadline,
}: {
  startDate: string;
  endDate: string;
  planningDeadline: string;
}) {
  const s = startDate ? Date.parse(startDate) : NaN;
  const e = endDate ? Date.parse(endDate) : NaN;
  const d = planningDeadline ? Date.parse(planningDeadline) : NaN;
  const hasRange = !Number.isNaN(s) && !Number.isNaN(e) && e > s;
  const frac = hasRange && !Number.isNaN(d) ? clamp((d - s) / (e - s), 0, 1) : null;
  const pct = frac === null ? 0 : frac * 100;

  return (
    <div className="px-2">
      <div className="relative h-24 select-none">
        {/* planning-deadline marker, pinned above the track */}
        {frac !== null ? (
          <div className="absolute top-3 flex flex-col items-center" style={{ left: `${pct}%`, transform: "translateX(-50%)" }}>
            <span className="whitespace-nowrap text-center">
              <span className="type-label tabular-nums text-foreground">{formatDate(planningDeadline)}</span>
              <span className="type-meta block text-muted-foreground">Planning deadline</span>
            </span>
            <span className="mt-1 h-3.5 w-px bg-border" aria-hidden />
          </div>
        ) : null}

        {/* base track */}
        <div className="absolute inset-x-0 top-[3.75rem] h-0.5 -translate-y-1/2 rounded-full bg-border" />
        {/* filled to the planning deadline */}
        {frac !== null ? (
          <div className="absolute left-0 top-[3.75rem] h-0.5 -translate-y-1/2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
        ) : null}

        <Node left="0%" filled />
        {frac !== null ? <Node left={`${pct}%`} filled /> : null}
        <Node left="100%" ring />

        {/* start / end labels below the track */}
        <Caption left="0%" transform="translateX(0)" textAlign="text-left" date={startDate} label="Cycle starts" />
        <Caption left="100%" transform="translateX(-100%)" textAlign="text-right" date={endDate} label="Cycle ends" />
      </div>
    </div>
  );
}

function Node({ left, filled, ring }: { left: string; filled?: boolean; ring?: boolean }) {
  return (
    <span
      style={{ left }}
      className={cn(
        "absolute top-[3.75rem] size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
        filled ? "bg-primary ring-4 ring-primary/15" : "",
        ring ? "border-2 border-primary bg-card" : "",
      )}
      aria-hidden
    />
  );
}

function Caption({
  left,
  transform,
  textAlign,
  date,
  label,
}: {
  left: string;
  transform: string;
  textAlign: string;
  date: string;
  label: string;
}) {
  return (
    <div className={cn("absolute top-[4.5rem] whitespace-nowrap", textAlign)} style={{ left, transform }}>
      <div className={cn("type-label tabular-nums", date ? "text-foreground" : "text-muted-foreground")}>
        {date ? formatDate(date) : "—"}
      </div>
      <div className="type-meta text-muted-foreground">{label}</div>
    </div>
  );
}
