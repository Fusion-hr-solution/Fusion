"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  createPerformanceApi,
  createPlatformApiClient,
  performanceQueryKeys,
  type PersonPerformanceSummaryDto,
} from "@repo/api";
import { Skeleton } from "@repo/ds";
import { formatPercent } from "@repo/ds/lib/numbers";

const PLAN = "/performance/plan";


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

type YearT = ReturnType<typeof useTranslations<"home.year">>;

function daysAgo(iso: string, now: Date, t: YearT): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? t("today") : days === 1 ? t("yesterday") : t("daysAgo", { count: days });
}

/** A plan's percentage, whole, in the person's language ("42%", "42 %"). */
function percent(value: number, locale: string): string {
  return formatPercent(Math.round(value) / 100, undefined, locale);
}

function Ring({ value }: { value: number }) {
  const t = useTranslations("home.year");
  const locale = useLocale();
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 88 88" className="size-[88px] shrink-0" role="img" aria-label={t("ring", { percent: percent(value, locale) })}>
      <circle cx="44" cy="44" r={radius} fill="none" stroke="var(--inlay)" strokeWidth="12" />
      <circle
        cx="44" cy="44" r={radius} fill="none" stroke="var(--primary)" strokeWidth="12" strokeLinecap="butt"
        strokeDasharray={`${(Math.min(value, 100) / 100) * circumference} ${circumference}`} transform="rotate(-90 44 44)"
      />
      <text x="44" y="50" textAnchor="middle" className="fill-foreground text-[18px] font-bold">{percent(value, locale)}</text>
    </svg>
  );
}

function StatusLine({ summary }: { summary: NonNullable<PersonPerformanceSummaryDto["currentCycle"]> }) {
  const t = useTranslations("home.year");
  const counts = { OnTrack: 0, AtRisk: 0, OffTrack: 0 };
  for (const objective of summary.objectives) if (objective.status) counts[objective.status] += 1;
  const parts = [
    counts.OnTrack ? { key: "on", label: t("onTrack", { count: counts.OnTrack }), tone: "bg-success" } : null,
    counts.AtRisk ? { key: "risk", label: t("atRisk", { count: counts.AtRisk }), tone: "bg-warning" } : null,
    counts.OffTrack ? { key: "off", label: t("offTrack", { count: counts.OffTrack }), tone: "bg-destructive" } : null,
  ].filter((part) => part !== null);
  if (parts.length === 0) return <p className="type-meta text-muted-foreground">{t("noStatus")}</p>;
  return (
    <p className="flex flex-wrap gap-x-3 type-meta">
      {parts.map((part) => (
        <span key={part.key} className="inline-flex items-center gap-1.5 text-foreground">
          <span aria-hidden className={`size-2 rounded-full ${part.tone}`} />
          {part.label}
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
  const t = useTranslations("home.year");
  const locale = useLocale();
  const summary = useMyYear(employeeId, enabled);
  if (!enabled || !employeeId) return null;
  if (summary.isPending) {
    return (
      <section aria-label={t("loading")} className="space-y-3">
        <h2 className="type-section-title text-foreground">{t("title")}</h2>
        <Skeleton className="h-32 w-full rounded-surface" />
      </section>
    );
  }
  if (summary.isError) {
    return (
      <section aria-labelledby="your-year-heading" className="space-y-3">
        <h2 id="your-year-heading" className="type-section-title text-foreground">{t("title")}</h2>
        <p className="type-body-secondary text-muted-foreground">{t("failed")}</p>
      </section>
    );
  }
  const cycle = summary.data.currentCycle;
  if (!cycle?.isParticipant) return null;
  const review = summary.data.reviews?.current;
  const approved = cycle.planStatus === "Approved";
  const now = new Date();

  return (
    <section lang={locale} aria-labelledby="your-year-heading" className="space-y-3">
      <div className="flex min-h-9 items-center justify-between gap-4">
        <h2 id="your-year-heading" className="type-section-title text-foreground">{t("title")}</h2>
        <a href={PLAN} className="inline-flex items-center gap-1 type-label text-foreground hover:text-primary">
          {t("myPlan")} <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </a>
      </div>
      <a href={PLAN} className="block rounded-surface bg-card p-5 transition-colors hover:bg-inlay">
        {approved ? (
          <div className="flex items-center gap-5">
            {cycle.overallProgress !== null ? <Ring value={cycle.overallProgress} /> : null}
            <div className="min-w-0 space-y-1.5">
              <p className="type-label text-foreground">{t("objectives", { count: cycle.objectives.length })}</p>
              <StatusLine summary={cycle} />
              <p className="type-meta text-muted-foreground">
                {review && review.state !== "SelfAssessment" && review.reviewerName
                  ? t("reviewWith", { name: review.reviewerName })
                  : cycle.lastUpdateAt
                    ? t("lastUpdate", { when: daysAgo(cycle.lastUpdateAt, now, t) })
                    : t("noUpdate")}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="flex items-center justify-between gap-3 type-label text-foreground">
              {cycle.cycleName}
              {cycle.phase ? <span className="type-meta text-success">{cycle.phase}</span> : null}
            </p>
            <p className="type-subsection-title text-foreground">{t(`plan.${cycle.planStatus ?? "NotStarted"}`)}</p>
            {cycle.planStatus && cycle.planStatus !== "NotStarted" ? (
              <p className="type-meta text-muted-foreground">
                {t("objectives", { count: cycle.objectives.length })}
                {cycle.weightTotal !== null && cycle.weightTotal !== undefined
                  ? t("weights", { percent: percent(cycle.weightTotal, locale) })
                  : ""}
              </p>
            ) : null}
            {cycle.reviewerName ? (
              <p className="border-t border-border pt-2 type-meta text-muted-foreground">{t("approves", { name: cycle.reviewerName })}</p>
            ) : null}
          </div>
        )}
      </a>
    </section>
  );
}
