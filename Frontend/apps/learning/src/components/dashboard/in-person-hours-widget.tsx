"use client";

import { useMemo } from "react";
import { Building2, Clock, Calendar, MapPin, Sparkles } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Card, CardContent, Skeleton } from "@repo/ui";
import { useApiQuery } from "@repo/api/react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { getMyInPersonHours } from "@/services/learning-service";
import { TRAINING_TYPE_CONFIG } from "@/data";
import type { AttendedSession } from "@/types";

interface KpiTileProps {
  label: string;
  value: string;
  hint?: string;
}

function KpiTile({ label, value, hint }: KpiTileProps) {
  return (
    <div className="flex flex-col rounded-xl border border-border/60 bg-card/60 px-4 py-3 backdrop-blur-sm">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 text-2xl font-bold leading-none text-foreground">
        {value}
      </span>
      {hint && (
        <span className="mt-1 text-[10px] text-muted-foreground">{hint}</span>
      )}
    </div>
  );
}

function SessionRow({ session }: { session: AttendedSession }) {
  const format = useFormatter();
  return (
    <li className="flex items-start gap-3 rounded-lg border border-border/40 bg-card/40 px-3 py-2.5 transition-colors hover:border-border hover:bg-card">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
        <Building2 className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {session.trainingTitle}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {session.partTitle}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" aria-hidden="true" />
            {format.dateTime(new Date(session.startUtc), {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          {session.room && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {session.room}
            </span>
          )}
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
        {session.hours.toFixed(1)}h
      </span>
    </li>
  );
}

function WidgetSkeleton() {
  return (
    <Card className="border-border/60">
      <CardContent className="space-y-4 py-6">
        <Skeleton className="h-5 w-48" />
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          <Skeleton className="h-56 rounded-xl lg:col-span-2" />
          <Skeleton className="h-56 rounded-xl lg:col-span-3" />
        </div>
      </CardContent>
    </Card>
  );
}

export function InPersonHoursWidget() {
  const t = useTranslations("dashboard.hours");
  const { data, isLoading, error } = useApiQuery(getMyInPersonHours);

  const chartData = useMemo(() => {
    if (!data) return [];
    return [
      {
        name: t("onSite"),
        value: Number(data.inPersonHours.toFixed(1)),
        fill: TRAINING_TYPE_CONFIG.OnSite.chartColor,
      },
      {
        name: t("eLearning"),
        value: Number(data.eLearningHours.toFixed(1)),
        fill: TRAINING_TYPE_CONFIG.ELearning.chartColor,
      },
    ];
  }, [data, t]);

  if (isLoading) return <WidgetSkeleton />;

  if (error || !data) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">{t("loadError")}</p>
        </CardContent>
      </Card>
    );
  }

  const totalRatio = data.inPersonHours + data.eLearningHours;
  const inPersonShare =
    totalRatio > 0 ? Math.round((data.inPersonHours / totalRatio) * 100) : 0;

  return (
    <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-emerald-50/20">
      <CardContent className="space-y-5 py-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {t("title")}
              </h2>
              <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
            </div>
          </div>
          <span className="hidden items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 sm:inline-flex">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            {t("inPersonShare", { share: inPersonShare })}
          </span>
        </div>

        {/* KPI tiles */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTile
            label={t("thisMonth")}
            value={`${data.totalHoursMonth.toFixed(1)}h`}
          />
          <KpiTile
            label={t("thisQuarter")}
            value={`${data.totalHoursQuarter.toFixed(1)}h`}
          />
          <KpiTile
            label={t("thisYear")}
            value={`${data.totalHoursYear.toFixed(1)}h`}
          />
          <KpiTile
            label={t("allTime")}
            value={`${data.totalHoursAllTime.toFixed(1)}h`}
          />
        </div>

        {/* Pie + Sessions */}
        <div className="grid gap-4 lg:grid-cols-5">
          {/* Pie chart */}
          <div className="rounded-xl border border-border/40 bg-card/40 p-4 lg:col-span-2">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("formatMix")}
            </h3>
            {totalRatio === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-1 text-center text-muted-foreground">
                <Clock className="h-6 w-6 opacity-50" />
                <p className="text-xs">{t("noHours")}</p>
              </div>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    >
                      {chartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))",
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [`${v.toFixed(1)}h`, ""]}
                    />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Sessions list */}
          <div className="rounded-xl border border-border/40 bg-card/40 p-4 lg:col-span-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("attendedSessions")}
              </h3>
              <span className="text-[11px] text-muted-foreground">
                {t("totalCount", { count: data.attendedSessions.length })}
              </span>
            </div>
            {data.attendedSessions.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-1 text-center text-muted-foreground">
                <Building2 className="h-6 w-6 opacity-50" />
                <p className="text-xs">{t("noSessions")}</p>
              </div>
            ) : (
              <ul className="ey-stagger-list max-h-64 space-y-2 overflow-y-auto pr-1">
                {data.attendedSessions.map((s) => (
                  <SessionRow key={s.sessionId} session={s} />
                ))}
              </ul>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
