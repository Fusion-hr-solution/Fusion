"use client";

import { useTranslations } from "next-intl";
import { GraduationCap, MessageSquare, Star, ThumbsUp } from "lucide-react";
import { Skeleton } from "@repo/ui";
import { KpiCard } from "@/components/kpi-card";
import { useTrainingFeedback } from "@/hooks/use-admin-feedback";
import { FeedbackDistributionChart } from "./feedback-distribution-chart";
import { FeedbackRadarChart } from "./feedback-radar-chart";
import { FeedbackTrendChart } from "./feedback-trend-chart";
import { FeedbackComments } from "./feedback-comments";

interface TrainingFeedbackPanelProps {
  trainingId: string;
}

export function TrainingFeedbackPanel({ trainingId }: TrainingFeedbackPanelProps) {
  const t = useTranslations("adminFeedback");
  const { data, isLoading } = useTrainingFeedback(trainingId);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[320px] rounded-xl" />
          <Skeleton className="h-[320px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (data.totalResponses === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-10 text-center">
        <MessageSquare className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t("training.noFeedback")}</p>
      </div>
    );
  }

  // The backend nulls avgTrainerRating when there are no trainer ratings (e-learning / no trainer),
  // so the DTO null is the single source of truth for whether to show the trainer dimension.
  const radar = [
    { dimension: t("dimensions.overall"), score: data.avgOverallRating },
    { dimension: t("dimensions.content"), score: data.avgContentRating },
    { dimension: t("dimensions.relevance"), score: data.avgRelevanceRating },
    ...(data.avgTrainerRating != null
      ? [{ dimension: t("dimensions.trainer"), score: data.avgTrainerRating }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard icon={Star} value={data.avgOverallRating.toFixed(2)} label={t("training.kpiAvg")} delayBase={0} />
        <KpiCard icon={MessageSquare} value={data.totalResponses} label={t("training.kpiResponses")} index={1} delayBase={0} />
        <KpiCard icon={ThumbsUp} value={`${data.recommendationRate}%`} label={t("training.kpiRecommend")} index={2} delayBase={0} />
        {data.avgTrainerRating != null ? (
          <KpiCard icon={GraduationCap} value={data.avgTrainerRating.toFixed(2)} label={t("training.kpiTrainer")} index={3} delayBase={0} />
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <FeedbackDistributionChart
          title={t("training.distribution")}
          countLabel={t("training.kpiResponses")}
          counts={data.ratingDistribution}
        />
        <FeedbackRadarChart title={t("training.dimensions")} data={radar} />
      </div>

      <FeedbackTrendChart
        title={t("training.trend")}
        ratingLabel={t("dimensions.overall")}
        points={data.monthlyTrend}
      />

      <FeedbackComments
        title={t("training.comments")}
        comments={data.comments}
        suppressed={data.commentsSuppressed}
        suppressedLabel={t("training.commentsSuppressed")}
        emptyLabel={t("training.noComments")}
      />
    </div>
  );
}
