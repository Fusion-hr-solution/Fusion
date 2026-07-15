"use client";

import { useTranslations } from "next-intl";
import { Laptop, Users as UsersIcon } from "lucide-react";
import { Skeleton } from "@repo/ui";
import type { FormatComparison, FormatMetrics } from "@/types/admin";
import { CompletionBarChart } from "../completion-bar-chart";

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function FormatCard({
  title,
  icon,
  m,
}: {
  title: string;
  icon: React.ReactNode;
  m: FormatMetrics;
}) {
  const t = useTranslations("reports");
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <MetricRow label={t("cols.trainings")} value={m.trainingCount} />
      <MetricRow label={t("cols.hoursDelivered")} value={`${m.hoursDelivered} h`} />
      <MetricRow label={t("cols.participants")} value={m.participants} />
      <MetricRow label={t("cols.rate")} value={`${m.completionRate}%`} />
      <MetricRow label={t("cols.avgFeedback")} value={m.avgFeedback != null ? `${m.avgFeedback} / 5` : "—"} />
    </div>
  );
}

export function FormatComparisonSection({
  data,
  isLoading,
}: {
  data: FormatComparison | undefined;
  isLoading: boolean;
}) {
  const t = useTranslations("reports");

  if (isLoading) return <Skeleton className="h-72 rounded-xl" />;
  if (!data) {
    return (
      <p className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
        {t("empty")}
      </p>
    );
  }

  const chartData = [
    { name: t("format.eLearning"), rate: data.eLearning.completionRate, count: data.eLearning.participants },
    { name: t("format.onSite"), rate: data.onSite.completionRate, count: data.onSite.participants },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <FormatCard title={t("format.eLearning")} icon={<Laptop className="h-4 w-4" />} m={data.eLearning} />
        <FormatCard title={t("format.onSite")} icon={<UsersIcon className="h-4 w-4" />} m={data.onSite} />
      </div>
      <CompletionBarChart data={chartData} title={t("completionByFormat")} />
    </div>
  );
}
