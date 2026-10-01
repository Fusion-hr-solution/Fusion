import type React from "react";
import { cn } from "@repo/ds/lib/utils";
import { formatDate } from "@/features/performance/lib";

/** Where the deadline marker may sit, in % of the track — keeps its label clear of start/end. */
const DEADLINE_MIN = 24;
const DEADLINE_MAX = 70;
const VERTICAL_MIN = 42;
const VERTICAL_MAX = 58;

/**
 * A dated window at a glance: start → an optional marker → end. Cycle setup marks the planning
 * deadline; an objective's detail marks today. The deadline is placed in
 * proportion to the dates, but eased into a readable band so it never crowds the start or end
 * labels — legibility wins over strict scale. Updates live as the dates change.
 */
export function CycleTimeline({
  startDate,
  endDate,
  marker,
  startLabel = "Cycle starts",
  endLabel = "Cycle ends",
  orientation = "horizontal",
  accent = "var(--primary)",
  compact = false,
}: {
  startDate: string;
  endDate: string;
  marker?: { date: string; label: string } | null;
  startLabel?: string;
  endLabel?: string;
  /** Vertical stacks the window top → bottom with labels beside it, for narrow columns. */
  orientation?: "horizontal" | "vertical";
  /** Track and node colour; amber unless the caller carries another accent. */
  accent?: string;
  /** Tighter rhythm for dense surfaces such as a detail drawer. */
  compact?: boolean;
}) {
  const accentStyle = { "--timeline-accent": accent, "--tl-y": compact ? "2.125rem" : "3.25rem", "--tl-gap": compact ? "0.875rem" : "1.25rem", "--tl-below": compact ? "3.25rem" : "4.25rem", "--tl-lg": compact ? "0px" : "0.125rem", "--tl-lh": compact ? "1.1" : "1.25" } as React.CSSProperties;
  const s = startDate ? Date.parse(startDate) : NaN;
  const e = endDate ? Date.parse(endDate) : NaN;
  const d = marker?.date ? Date.parse(marker.date) : NaN;
  const hasRange = !Number.isNaN(s) && !Number.isNaN(e) && e > s;
  const frac = hasRange && !Number.isNaN(d) ? Math.min(1, Math.max(0, (d - s) / (e - s))) : null;
  const pct = frac === null ? null : DEADLINE_MIN + frac * (DEADLINE_MAX - DEADLINE_MIN);

  if (orientation === "vertical") {
    // A narrow column fits three labels only with the marker held near the middle.
    const vPct = frac === null ? null : VERTICAL_MIN + frac * (VERTICAL_MAX - VERTICAL_MIN);
    return (
      <div style={accentStyle} className={cn("relative h-full select-none", compact ? "py-2" : "py-4", vPct !== null && marker ? (compact ? "min-h-[6.5rem]" : "min-h-[9.5rem]") : compact ? "min-h-[4.5rem]" : "min-h-[6rem]")}>
        <div className="relative h-full">
          <div
            className={cn(
              "absolute inset-y-0 left-2 w-0.5 -translate-x-1/2 rounded-full",
              hasRange ? "bg-(--timeline-accent)" : "bg-border",
            )}
          />
          <VNode top="0%" filled={hasRange} />
          <VLabel top="0%" date={startDate} label={startLabel} />
          {vPct !== null && marker ? (
            <>
              <VNode top={`${vPct}%`} filled />
              <VLabel top={`${vPct}%`} date={marker.date} label={marker.label} />
            </>
          ) : null}
          <VNode top="100%" ring />
          <VLabel top="100%" date={endDate} label={endLabel} />
        </div>
      </div>
    );
  }

  return (
    <div style={accentStyle} className="relative h-[calc(var(--tl-y)+var(--tl-below))] select-none px-1.5">
      <div className="relative h-full">
        {/* track */}
        <div
          className={cn(
            "absolute inset-x-0 top-(--tl-y) h-0.5 -translate-y-1/2 rounded-full",
            hasRange ? "bg-(--timeline-accent)" : "bg-border",
          )}
        />

        {/* marker: label above, dashed tick down to the node */}
        {pct !== null && marker ? (
          <>
            <Tick left={`${pct}%`} className="top-1 h-(--tl-y)" />
            <Label left={`${pct}%`} className="top-0" date={marker.date} label={marker.label} />
            <Node left={`${pct}%`} filled />
          </>
        ) : null}

        {/* start: node, dashed tick down, label */}
        <Node left="0%" filled={hasRange} />
        <Tick left="0%" className="top-(--tl-y) h-(--tl-gap)" />
        <Label left="0%" className="top-[calc(var(--tl-y)+var(--tl-gap))]" date={startDate} label={startLabel} />

        {/* end: hollow node, label right-aligned under it */}
        <Node left="100%" ring />
        <Label left="100%" className="top-[calc(var(--tl-y)+var(--tl-gap))]" date={endDate} label={endLabel} alignEnd />
      </div>
    </div>
  );
}

function Node({ left, filled, ring }: { left: string; filled?: boolean; ring?: boolean }) {
  return (
    <span
      style={{ left }}
      className={cn(
        "absolute top-(--tl-y) z-10 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full",
        filled ? "bg-(--timeline-accent) ring-4 ring-(--timeline-accent)/15" : "",
        ring ? "border-2 border-(--timeline-accent) bg-card" : "",
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
      className={cn("absolute w-0 -translate-x-1/2 border-l border-dashed border-(--timeline-accent)/60", className)}
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
      <div className={cn("text-[0.8125rem] font-semibold leading-(--tl-lh) tabular-nums", date ? "text-foreground" : "text-muted-foreground")}>
        {date ? formatDate(date) : "—"}
      </div>
      <div className="mt-(--tl-lg) text-xs leading-(--tl-lh) text-muted-foreground">{label}</div>
    </div>
  );
}

function VNode({ top, filled, ring }: { top: string; filled?: boolean; ring?: boolean }) {
  return (
    <span
      style={{ top }}
      className={cn(
        "absolute left-2 z-10 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full",
        filled ? "bg-(--timeline-accent) ring-4 ring-(--timeline-accent)/15" : "",
        ring ? "border-2 border-(--timeline-accent) bg-card" : "",
        !filled && !ring ? "border-2 border-border bg-card" : "",
      )}
      aria-hidden
    />
  );
}

function VLabel({ top, date, label }: { top: string; date: string; label: string }) {
  return (
    <div style={{ top }} className="absolute left-7 -translate-y-1/2 whitespace-nowrap leading-tight">
      <div className={cn("text-[0.8125rem] font-semibold leading-(--tl-lh) tabular-nums", date ? "text-foreground" : "text-muted-foreground")}>
        {date ? formatDate(date) : "—"}
      </div>
      <div className="mt-(--tl-lg) text-xs leading-(--tl-lh) text-muted-foreground">{label}</div>
    </div>
  );
}
