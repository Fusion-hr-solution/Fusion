"use client";

import { AlertTriangle, ArrowRight, Check, Circle } from "lucide-react";
import type { LaunchReadinessDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { cn } from "@repo/ds/lib/utils";

const AREA_ORDER = ["details", "direction", "population"] as const;

/**
 * The Draft-Overview's dominant surface: what remains before the Cycle can go live. Each area is
 * an affordance into its setup surface; blockers are stated plainly; activation is the one clear
 * dominant action, enabled only when the Cycle is genuinely activatable.
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
    (a, b) => AREA_ORDER.indexOf(a.key as (typeof AREA_ORDER)[number]) - AREA_ORDER.indexOf(b.key as (typeof AREA_ORDER)[number])
  );
  const completeCount = areas.filter((area) => area.complete).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-semibold">Launch readiness</h2>
          <p className="text-sm text-muted-foreground">
            {completeCount} of {areas.length} areas ready
          </p>
        </div>
        {readiness.canActivate && onActivate ? (
          <Button size="lg" onClick={onActivate} disabled={activating}>
            Review &amp; activate
            <ArrowRight className="size-4" data-icon="inline-end" />
          </Button>
        ) : null}
      </div>

      <ul className="grid gap-2 sm:grid-cols-3">
        {areas.map((area) => {
          const interactive = Boolean(onOpenArea) && !area.complete;
          return (
            <li key={area.key}>
              <button
                type="button"
                onClick={onOpenArea ? () => onOpenArea(area.key) : undefined}
                disabled={!onOpenArea}
                className={cn(
                  "flex h-full w-full flex-col gap-1.5 rounded-xl border p-4 text-left transition-colors",
                  area.complete
                    ? "border-border bg-muted/30"
                    : "border-dashed border-primary/40 bg-primary/[0.04]",
                  interactive && "hover:border-primary/60 hover:bg-primary/[0.07]",
                  onOpenArea && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full",
                      area.complete ? "bg-primary text-primary-foreground" : "border border-primary/50 text-primary"
                    )}
                  >
                    {area.complete ? <Check className="size-3" aria-hidden /> : <Circle className="size-2 fill-current" aria-hidden />}
                  </span>
                  <span className="text-sm font-medium">{area.label}</span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {area.complete ? "Ready" : (area.detail ?? "Needs attention")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {readiness.blockers.length > 0 && !readiness.canActivate ? (
        <div className="rounded-lg border border-warning/30 bg-warning-subtle p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-warning">
            <AlertTriangle className="size-3.5 text-warning" aria-hidden />
            Before this Cycle can go live
          </p>
          <ul className="mt-1.5 space-y-1 pl-5 text-sm text-muted-foreground">
            {readiness.blockers.map((blocker) => (
              <li key={blocker} className="list-disc marker:text-warning/60">
                {blocker}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
