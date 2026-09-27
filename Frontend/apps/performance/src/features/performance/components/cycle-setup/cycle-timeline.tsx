import { cn } from "@repo/ds/lib/utils";
import { formatDate } from "@/features/performance/lib";

/** Where the deadline marker may sit, in % of the track — keeps its label clear of start/end. */
const DEADLINE_MIN = 24;
const DEADLINE_MAX = 70;

/**
 * The cycle's shape at a glance: start → planning deadline → end. The deadline is placed in
 * proportion to the dates, but eased into a readable band so it never crowds the start or end
 * labels — legibility wins over strict scale. Updates live as the dates change.
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
  const frac = hasRange && !Number.isNaN(d) ? Math.min(1, Math.max(0, (d - s) / (e - s))) : null;
  const pct = frac === null ? null : DEADLINE_MIN + frac * (DEADLINE_MAX - DEADLINE_MIN);

  return (
    <div className="relative h-[7.5rem] select-none px-1.5">
      <div className="relative h-full">
        {/* track */}
        <div
          className={cn(
            "absolute inset-x-0 top-[3.25rem] h-0.5 -translate-y-1/2 rounded-full",
            hasRange ? "bg-primary" : "bg-border",
          )}
        />

        {/* planning deadline: label above, dashed tick down to the node */}
        {pct !== null ? (
          <>
            <Tick left={`${pct}%`} className="top-1 h-[3.25rem]" />
            <Label left={`${pct}%`} className="top-0" date={planningDeadline} label="Planning deadline" />
            <Node left={`${pct}%`} filled />
          </>
        ) : null}

        {/* start: node, dashed tick down, label */}
        <Node left="0%" filled={hasRange} />
        <Tick left="0%" className="top-[3.25rem] h-7" />
        <Label left="0%" className="top-[4.5rem]" date={startDate} label="Cycle starts" />

        {/* end: hollow node, label right-aligned under it */}
        <Node left="100%" ring />
        <Label left="100%" className="top-[4.5rem]" date={endDate} label="Cycle ends" alignEnd />
      </div>
    </div>
  );
}

function Node({ left, filled, ring }: { left: string; filled?: boolean; ring?: boolean }) {
  return (
    <span
      style={{ left }}
      className={cn(
        "absolute top-[3.25rem] z-10 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full",
        filled ? "bg-primary ring-4 ring-primary/15" : "",
        ring ? "border-2 border-primary bg-card" : "",
        !filled && !ring ? "border-2 border-border bg-card" : "",
      )}
      aria-hidden
    />
  );
}

function Tick({ left, className }: { left: string; className: string }) {
  return (
    <span
      style={{ left }}
      className={cn("absolute w-0 -translate-x-1/2 border-l border-dashed border-primary/60", className)}
      aria-hidden
    />
  );
}

function Label({
  left,
  className,
  date,
  label,
  alignEnd,
}: {
  left: string;
  className: string;
  date: string;
  label: string;
  alignEnd?: boolean;
}) {
  return (
    <div
      style={{ left, transform: alignEnd ? "translateX(-100%)" : "translateX(0.5rem)" }}
      className={cn("absolute whitespace-nowrap leading-tight", alignEnd ? "text-right" : "text-left", className)}
    >
      <div className={cn("text-[0.8125rem] font-semibold tabular-nums", date ? "text-foreground" : "text-muted-foreground")}>
        {date ? formatDate(date) : "—"}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
