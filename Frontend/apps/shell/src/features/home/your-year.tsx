"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import {
  createPerformanceApi,
  createPlatformApiClient,
  performanceQueryKeys,
  type PersonPerformanceSummaryDto,
  type RosterPlanStatus,
} from "@repo/api";
import { Skeleton } from "@repo/ds";

const PLAN = "/performance/plan";

const PLAN_STATE: Record<RosterPlanStatus, string> = {
  NotStarted: "Your plan isn't started",
  Draft: "Your plan is a draft",
  ReturnedForChanges: "Your plan came back with changes",
  Submitted: "Your plan is submitted",
  Approved: "Your plan is approved",
};

/** The viewer's own Performance summary (D-32): the same read Performance's person page uses. */
export function useMyYear(employeeId: string | null | undefined, enabled: boolean) {
  const api = useMemo(() => createPerformanceApi(createPlatformApiClient()), []);
  return useQuery({
    queryKey: performanceQueryKeys.personSummary(employeeId ?? "none"),
    queryFn: ({ signal }) => api.getPersonSummary(employeeId!, null, signal),
    enabled: enabled && Boolean(employeeId),
    staleTime: 60_000,
    retry: false,
  });
}

function daysAgo(iso: string, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

function Ring({ value }: { value: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 88 88" className="size-[88px] shrink-0" role="img" aria-label={`Plan at ${Math.round(value)}%`}>
      <circle cx="44" cy="44" r={radius} fill="none" stroke="var(--inlay)" strokeWidth="12" />
      <circle
        cx="44" cy="44" r={radius} fill="none" stroke="var(--primary)" strokeWidth="12" strokeLinecap="butt"
        strokeDasharray={`${(Math.min(value, 100) / 100) * circumference} ${circumference}`} transform="rotate(-90 44 44)"
      />
      <text x="44" y="50" textAnchor="middle" className="fill-foreground text-[18px] font-bold">{Math.round(value)}%</text>
    </svg>
  );
}

function StatusLine({ summary }: { summary: NonNullable<PersonPerformanceSummaryDto["currentCycle"]> }) {
  const counts = { OnTrack: 0, AtRisk: 0, OffTrack: 0 };
  for (const objective of summary.objectives) if (objective.status) counts[objective.status] += 1;
  const parts = [
    counts.OnTrack ? { n: counts.OnTrack, label: "on track", tone: "bg-success" } : null,
    counts.AtRisk ? { n: counts.AtRisk, label: "at risk", tone: "bg-warning" } : null,
    counts.OffTrack ? { n: counts.OffTrack, label: "off track", tone: "bg-destructive" } : null,
  ].filter((part) => part !== null);
  if (parts.length === 0) return <p className="type-meta text-muted-foreground">No status yet</p>;
  return (
    <p className="flex flex-wrap gap-x-3 type-meta">
      {parts.map((part) => (
        <span key={part.label} className="inline-flex items-center gap-1.5 text-foreground">
          <span aria-hidden className={`size-2 rounded-full ${part.tone}`} />
          {part.n} {part.label}
        </span>
      ))}
    </p>
  );
}

/**
 * Your year on the home (fusion-home): one card, not a second Overview. Before approval the plan's state, objectives
 * and weight with who approves it; after, plan progress, objectives by owner-set status and the last update; during a
 * review, who holds it. It opens My Plan. People outside the current cycle get no card.
 */
export function YourYear({ employeeId, enabled }: { employeeId: string | null | undefined; enabled: boolean }) {
  const summary = useMyYear(employeeId, enabled);
  if (!enabled || !employeeId) return null;
  if (summary.isPending) {
    return (
      <section aria-label="Loading your year" className="space-y-3">
        <h2 className="type-section-title text-foreground">Your year</h2>
        <Skeleton className="h-32 w-full rounded-surface" />
      </section>
    );
  }
  if (summary.isError) {
    return (
      <section aria-labelledby="your-year-heading" className="space-y-3">
        <h2 id="your-year-heading" className="type-section-title text-foreground">Your year</h2>
        <p className="type-body-secondary text-muted-foreground">Couldn&apos;t be loaded</p>
      </section>
    );
  }
  const cycle = summary.data.currentCycle;
  if (!cycle?.isParticipant) return null;
  const review = summary.data.reviews?.current;
  const approved = cycle.planStatus === "Approved";
  const now = new Date();

  return (
    <section aria-labelledby="your-year-heading" className="space-y-3">
      <div className="flex min-h-9 items-center justify-between gap-4">
        <h2 id="your-year-heading" className="type-section-title text-foreground">Your year</h2>
        <a href={PLAN} className="inline-flex items-center gap-1 type-label text-foreground hover:text-primary">
          My Plan <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </a>
      </div>
      <a href={PLAN} className="block rounded-surface bg-card p-5 transition-colors hover:bg-inlay">
        {approved ? (
          <div className="flex items-center gap-5">
            {cycle.overallProgress !== null ? <Ring value={cycle.overallProgress} /> : null}
            <div className="min-w-0 space-y-1.5">
              <p className="type-label text-foreground">
                {cycle.objectives.length} {cycle.objectives.length === 1 ? "objective" : "objectives"}
              </p>
              <StatusLine summary={cycle} />
              <p className="type-meta text-muted-foreground">
                {review && review.state !== "SelfAssessment" && review.reviewerName
                  ? `Your review is with ${review.reviewerName}`
                  : cycle.lastUpdateAt
                    ? `Last update ${daysAgo(cycle.lastUpdateAt, now)}`
                    : "No update yet"}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="flex items-center justify-between gap-3 type-label text-foreground">
              {cycle.cycleName}
              {cycle.phase ? <span className="type-meta text-success">{cycle.phase}</span> : null}
            </p>
            <p className="type-subsection-title text-foreground">{cycle.planStatus ? PLAN_STATE[cycle.planStatus] : PLAN_STATE.NotStarted}</p>
            {cycle.planStatus && cycle.planStatus !== "NotStarted" ? (
              <p className="type-meta text-muted-foreground">
                {cycle.objectives.length} {cycle.objectives.length === 1 ? "objective" : "objectives"}
                {cycle.weightTotal !== null && cycle.weightTotal !== undefined ? ` · weights at ${Math.round(cycle.weightTotal)}%` : ""}
              </p>
            ) : null}
            {cycle.reviewerName ? (
              <p className="border-t border-border pt-2 type-meta text-muted-foreground">{cycle.reviewerName} approves it</p>
            ) : null}
          </div>
        )}
      </a>
    </section>
  );
}
