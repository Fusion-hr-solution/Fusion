"use client";

import { ArrowRight, Check } from "lucide-react";
import type { LaunchReadinessDto } from "@repo/api";
import { AsyncButton } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";

const AREA_ORDER = ["details", "direction", "population"] as const;

/**
 * What remains before the Cycle can go live, as one readiness checklist rather than a
 * row of equal tiles. Each area states its own status and consequence; an incomplete
 * area is a direct affordance into its setup surface; activation is the single dominant
 * action, enabled only when the Cycle is genuinely activatable.
 */
export function LaunchReadiness({
  readiness,
  onOpenArea,
  onActivate,
  activating,
}: {
  readiness: LaunchReadinessDto;
  onOpenArea?: (area: string) => void;
  onActivate?: () => void;
  activating?: boolean;
}) {
  const areas = [...readiness.areas].sort(
    (a, b) =>
      AREA_ORDER.indexOf(a.key as (typeof AREA_ORDER)[number]) -
      AREA_ORDER.indexOf(b.key as (typeof AREA_ORDER)[number])
  );
  const completeCount = areas.filter((area) => area.complete).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="type-section-title text-foreground">Launch readiness</h2>
        <p className="text-sm text-muted-foreground tabular-nums">
          {completeCount} of {areas.length} ready
        </p>
      </div>

      <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border bg-card">
        {areas.map((area) => {
          const interactive = Boolean(onOpenArea) && !area.complete;
          const RowTag = interactive ? "button" : "div";
          return (
            <li key={area.key}>
              <RowTag
                {...(interactive
                  ? { type: "button" as const, onClick: () => onOpenArea?.(area.key) }
                  : {})}
                className={cn(
                  "flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors",
                  interactive &&
                    "cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full",
                    area.complete
                      ? "bg-success/15 text-success"
                      : "border border-dashed border-destructive/60"
                  )}
                  aria-hidden
                >
                  {area.complete ? <Check className="size-3" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">
                    {area.label}
                  </span>
                  <span
                    className={cn(
                      "block text-sm",
                      area.complete ? "text-muted-foreground" : "text-destructive"
                    )}
                  >
                    {area.complete ? "Ready" : (area.detail ?? "Needs attention")}
                  </span>
                </span>
                {interactive ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
                    Set up
                    <ArrowRight className="size-3.5" aria-hidden />
                  </span>
                ) : null}
              </RowTag>
            </li>
          );
        })}
      </ul>

      {readiness.canActivate && onActivate ? (
        <div className="flex justify-end">
          <AsyncButton size="lg" onClick={onActivate} pending={activating ?? false}>
            Review &amp; activate
            <ArrowRight className="size-4" data-icon="inline-end" />
          </AsyncButton>
        </div>
      ) : null}
    </div>
  );
}
