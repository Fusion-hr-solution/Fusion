"use client";

import { useCallback, useMemo, useState } from "react";
import { CalendarCheck2, CalendarClock, Clock, Filter } from "lucide-react";
import { Button, Skeleton } from "@repo/ui";
import { useApiQuery } from "@repo/api/react";
import { useTranslations } from "next-intl";
import { getAllMyEnrollments } from "@/services/enrollment-service";
import { SessionTrainingGroup } from "./session-training-group";

type ViewFilter = "upcoming" | "past" | "all";

export function MySessionsPage() {
  const t = useTranslations("mySessions");
  const [filter, setFilter] = useState<ViewFilter>("upcoming");

  const fetcher = useCallback(() => getAllMyEnrollments(), []);
  const { data: enrollments, isLoading } = useApiQuery(fetcher);

  const now = useMemo(() => new Date().toISOString(), []);

  const filtered = useMemo(() => {
    if (!enrollments) return [];
    if (filter === "all") return enrollments;

    return enrollments
      .map((training) => ({
        ...training,
        sessions: training.sessions.filter((s) => {
          if (filter === "upcoming") return s.endUtc > now;
          return s.endUtc <= now;
        }),
      }))
      .filter((t) => t.sessions.length > 0);
  }, [enrollments, filter, now]);

  const totalUpcoming = useMemo(() => {
    if (!enrollments) return 0;
    return enrollments.reduce(
      (acc, t) => acc + t.sessions.filter((s) => s.endUtc > now).length,
      0,
    );
  }, [enrollments, now]);

  const totalPast = useMemo(() => {
    if (!enrollments) return 0;
    return enrollments.reduce(
      (acc, t) => acc + t.sessions.filter((s) => s.endUtc <= now).length,
      0,
    );
  }, [enrollments, now]);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const totalSessions = (enrollments ?? []).reduce((acc, t) => acc + t.sessions.length, 0);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-white shadow-md">
            <CalendarCheck2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={<CalendarClock className="h-4 w-4" />}
          label={t("stats.upcoming")}
          value={totalUpcoming}
          accent="text-primary"
          bgAccent="bg-primary/10"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label={t("stats.past")}
          value={totalPast}
          accent="text-emerald-600"
          bgAccent="bg-emerald-50"
        />
        <StatCard
          icon={<CalendarCheck2 className="h-4 w-4" />}
          label={t("stats.total")}
          value={totalSessions}
          accent="text-muted-foreground"
          bgAccent="bg-muted/40"
        />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <div className="flex gap-1 rounded-lg border border-border/50 bg-muted/30 p-0.5">
          {(["upcoming", "past", "all"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "ghost"}
              size="sm"
              className={`h-7 px-3 text-xs font-medium ${filter === f ? "" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setFilter(f)}
            >
              {t(`filter.${f}`)}
            </Button>
          ))}
        </div>
        <span className="ml-2 text-xs text-muted-foreground">
          {t("trainingCount", { count: filtered.length })}
        </span>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="space-y-4">
          {filtered.map((training) => (
            <SessionTrainingGroup key={training.trainingId} training={training} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
  bgAccent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
  bgAccent: string;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border border-border/50 ${bgAccent} p-4`}>
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-card shadow-sm ${accent}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function EmptyState({ filter }: { filter: ViewFilter }) {
  const t = useTranslations("mySessions");

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/50">
        <CalendarCheck2 className="h-7 w-7 text-muted-foreground/50" />
      </div>
      <p className="mt-4 text-sm font-medium text-foreground">{t(`empty.${filter}.title`)}</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{t(`empty.${filter}.description`)}</p>
    </div>
  );
}
