"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, MessageSquare, Star, ThumbsUp, Users } from "lucide-react";
import { Skeleton } from "@repo/ui";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { KpiCard } from "@/components/kpi-card";
import { useFeedbackOverview } from "@/hooks/use-admin-feedback";
import type { FeedbackOverviewFilters, FeedbackTrainingRating } from "@/types/admin";
import { FeedbackDistributionChart } from "./feedback-distribution-chart";
import { FeedbackTrendChart } from "./feedback-trend-chart";

function TrainingRatingList({
  title,
  items,
  emptyLabel,
  responsesLabel,
}: {
  title: string;
  items: FeedbackTrainingRating[];
  emptyLabel: string;
  responsesLabel: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.trainingId}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-muted/30 px-3 py-2"
            >
              <Link
                href={`/admin/trainings/${encodeURIComponent(it.trainingId)}`}
                className="truncate text-sm text-foreground hover:underline"
              >
                {it.trainingTitle}
              </Link>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {it.responseCount} {responsesLabel}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                  <Star
                    className="h-3.5 w-3.5 text-[hsl(var(--ey-yellow))]"
                    fill="currentColor"
                    aria-hidden="true"
                  />
                  {it.avgOverallRating.toFixed(2)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FeedbackOverviewView() {
  const t = useTranslations("adminFeedback");
  const tCommon = useTranslations("common");
  const [format, setFormat] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filters: FeedbackOverviewFilters = useMemo(
    () => ({
      format: format || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
    }),
    [format, from, to],
  );

  const { data, isLoading } = useFeedbackOverview(filters);

  return (
    <div className="space-y-6 p-6">
      <PageBreadcrumb
        backHref="/admin"
        backLabel={tCommon("actions.back")}
        items={[{ label: t("overview.title") }]}
      />
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("overview.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("overview.subtitle")}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("filters.format")}
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">{t("filters.allFormats")}</option>
            <option value="ELearning">{t("filters.eLearning")}</option>
            <option value="OnSite">{t("filters.onSite")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("filters.from")}
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("filters.to")}
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <div className="ml-auto flex items-center gap-4">
          <Link
            href="/admin/feedback/config"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--ey-blue-600))] hover:underline"
          >
            {t("overview.configureLink")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/admin/feedback/trainers"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--ey-blue-600))] hover:underline"
          >
            {t("overview.byTrainerLink")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="space-y-6">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-[320px] rounded-xl" />
        </div>
      ) : data.totalFeedbacks === 0 ? (
        <p className="rounded-xl border border-border/60 bg-card p-10 text-center text-sm text-muted-foreground">
          {t("overview.noData")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <KpiCard icon={Star} value={data.avgOverallRating.toFixed(2)} label={t("overview.kpiAvg")} delayBase={0} />
            <KpiCard icon={MessageSquare} value={data.totalFeedbacks} label={t("overview.kpiTotal")} index={1} delayBase={0} />
            <KpiCard icon={Users} value={`${data.responseRate}%`} label={t("overview.kpiResponseRate")} index={2} delayBase={0} />
            <KpiCard icon={ThumbsUp} value={`${data.recommendationRate}%`} label={t("overview.kpiRecommend")} index={3} delayBase={0} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <FeedbackDistributionChart
              title={t("overview.distribution")}
              countLabel={t("overview.responses")}
              counts={data.ratingDistribution}
            />
            <FeedbackTrendChart
              title={t("overview.trend")}
              ratingLabel={t("overview.kpiAvg")}
              points={data.monthlyTrend}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <TrainingRatingList
              title={t("overview.topTrainings")}
              items={data.topTrainings}
              emptyLabel={t("overview.noData")}
              responsesLabel={t("overview.responses")}
            />
            <TrainingRatingList
              title={t("overview.bottomTrainings")}
              items={data.bottomTrainings}
              emptyLabel={t("overview.noData")}
              responsesLabel={t("overview.responses")}
            />
          </div>
        </>
      )}
    </div>
  );
}
