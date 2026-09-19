"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, Check, Info, Rocket, TriangleAlert } from "lucide-react";
import type { CycleDetailDto } from "@repo/api";
import { AsyncButton } from "@repo/ds/shell";
import { Button } from "@repo/ds/components/ui/button";
import { formatDate } from "../../../lib";

function StatusChip({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-background/50 px-3.5 py-2.5">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
        <Check className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0 type-meta leading-tight">
        <span className="block font-semibold text-foreground">{value}</span>
        <span className="block text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

/**
 * The decision banner. When the Cycle has cleared every check it presents launch as the one
 * dominant, irreversible action; when something still blocks it, it states the blockers plainly
 * and withholds the action rather than offering a button that would fail.
 */
export function LaunchHero({
  detail,
  onLaunch,
  launching,
}: {
  detail: CycleDetailDto;
  onLaunch: () => void;
  launching: boolean;
}) {
  const ready = detail.launchReadiness.canActivate;

  if (!ready) {
    const blockers = detail.launchReadiness.blockers;
    return (
      <section className="rounded-2xl border border-warning/40 bg-warning/[0.06] p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
            <TriangleAlert className="size-5.5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="type-section-title text-foreground">Not ready to launch yet</h2>
            {blockers.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {blockers.map((blocker) => (
                  <li key={blocker} className="type-body-secondary text-foreground">
                    {blocker}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 type-body-secondary text-muted-foreground">
                Resolve the outstanding setup before launching.
              </p>
            )}
            <Button variant="outline" size="sm" asChild className="mt-4">
              <Link href="/cycle/setup/population">Back to population</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-card p-5 shadow-sm sm:p-6">
      {/* Amber glow — the "primed to launch" character, quiet in light, luminous in dark. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-16 size-72 rounded-full bg-primary/15 blur-3xl"
      />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-4 sm:gap-5">
            <span
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-4 ring-primary/20 sm:size-16"
              aria-hidden
            >
              <Check className="size-7 sm:size-8" strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Ready to launch
              </h2>
              <p className="mt-1 type-body-secondary text-muted-foreground">
                Everything required for{" "}
                <span className="font-medium text-foreground">{detail.cycle.name}</span> is in place.
                Activate it to open planning for participants.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
            <StatusChip value="Cycle details" label="complete" />
            <StatusChip
              value={`${detail.publishedStrategyCount} objective${detail.publishedStrategyCount === 1 ? "" : "s"}`}
              label="published"
            />
            <StatusChip value={detail.confirmedParticipantCount} label="participants confirmed" />
            <StatusChip value={detail.launchReadiness.blockers.length} label="blockers" />
          </div>
        </div>

        <div className="shrink-0 lg:pl-4">
          <AsyncButton size="lg" className="w-full lg:w-auto" onClick={onLaunch} pending={launching}>
            <Rocket className="size-4" data-icon="inline-start" />
            Launch cycle
          </AsyncButton>
        </div>
      </div>

      <div className="relative mt-6 flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:gap-6">
        <span className="inline-flex items-center gap-2 type-meta text-foreground">
          <CalendarDays className="size-4 text-primary" aria-hidden />
          Planning opens through {formatDate(detail.cycle.planningDeadline)}
        </span>
        <span className="inline-flex items-center gap-2 type-meta text-muted-foreground">
          <Info className="size-4 shrink-0" aria-hidden />
          Activation freezes the roster and published direction for this cycle.
        </span>
      </div>
    </section>
  );
}
