"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  BookOpen,
  Clock,
  CheckCircle2,
  TrendingUp,
  ChevronRight,
  Target,
  Zap,
} from "lucide-react";
import type { Training, EnrolledTraining, TrainingCategory } from "@/types";
import { PageHeader } from "../page-header";
import { ContinueCard } from "./continue-card";
import { RecommendedCard } from "./recommended-card";
import { ProgressRing } from "./progress-ring";
import { CategoryBreakdown } from "./category-breakdown";
import { AchievementsCard } from "./achievements-card";

interface DashboardProps {
  trainings: Training[];
  enrolledTrainings: EnrolledTraining[];
}

export function Dashboard({ trainings, enrolledTrainings }: DashboardProps) {
  const stats = useMemo(() => {
    const inProgress = enrolledTrainings.filter((t) => t.status === "in-progress");
    const completed = enrolledTrainings.filter((t) => t.status === "completed");
    const totalHours = enrolledTrainings.reduce(
      (sum, t) => sum + parseInt(t.duration.replace(/\D/g, "")),
      0
    );
    const completedHours = completed.reduce(
      (sum, t) => sum + parseInt(t.duration.replace(/\D/g, "")),
      0
    );
    const completionRate =
      enrolledTrainings.length > 0
        ? Math.round((completed.length / enrolledTrainings.length) * 100)
        : 0;
    const avgProgress =
      inProgress.length > 0
        ? Math.round(inProgress.reduce((sum, t) => sum + t.progress, 0) / inProgress.length)
        : 0;

    return { inProgress, completed, totalHours, completedHours, completionRate, avgProgress };
  }, [enrolledTrainings]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<TrainingCategory, number>();
    for (const t of enrolledTrainings) {
      map.set(t.category, (map.get(t.category) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({
        category,
        count,
        percentage: Math.round((count / enrolledTrainings.length) * 100),
      }));
  }, [enrolledTrainings]);

  const continueTrainings = stats.inProgress
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 3);

  const enrolledIds = new Set(enrolledTrainings.map((t) => t.id));
  const recommended = trainings
    .filter((t) => !enrolledIds.has(t.id))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 4);

  return (
    <>
      <PageHeader
        moduleTitle="Learning Dashboard"
        title="Welcome back"
        description="Here's your learning journey at a glance. Keep pushing — you're making great progress."
      >

          {/* ── KPI cards row ── */}
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {[
              { icon: BookOpen, value: stats.inProgress.length, label: "In Progress", accent: "bg-[hsl(var(--ey-grey-100))]", iconColor: "text-[hsl(var(--ey-grey-400))]" },
              { icon: CheckCircle2, value: stats.completed.length, label: "Completed", accent: "bg-[hsl(var(--ey-grey-100))]", iconColor: "text-[hsl(var(--ey-grey-400))]" },
              { icon: Clock, value: `${stats.completedHours}h`, label: "Hours Learned", accent: "bg-[hsl(var(--ey-grey-100))]", iconColor: "text-[hsl(var(--ey-grey-400))]" },
              { icon: TrendingUp, value: `${stats.completionRate}%`, label: "Completion Rate", accent: "bg-[hsl(var(--ey-grey-100))]", iconColor: "text-[hsl(var(--ey-grey-400))]" },
            ].map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <div
                  key={kpi.label}
                  className="ey-animate-fade-up group flex items-center gap-3.5 rounded-xl border border-border/60 bg-white px-4 py-4 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                  style={{ animationDelay: `${280 + i * 60}ms` }}
                >
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${kpi.accent} transition-transform duration-300 group-hover:scale-105`}>
                    <Icon className={`h-5 w-5 ${kpi.iconColor}`} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground leading-none tabular-nums">{kpi.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{kpi.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
      </PageHeader>

      {/* ── Dashboard grid ── */}
      <section className="px-8 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── LEFT COLUMN (2/3) ── */}
          <div className="space-y-6 lg:col-span-2">
            {continueTrainings.length > 0 && (
              <div className="ey-animate-fade-up">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg ey-bg-dark">
                      <Zap className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                    </div>
                    <h2 className="text-base font-bold text-foreground">Continue Learning</h2>
                  </div>
                  <Link
                    href="/my-trainings"
                    className="flex items-center gap-1 text-xs font-semibold text-[hsl(var(--ey-blue-600))] hover:underline transition-colors"
                  >
                    View all
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>

                <div className="ey-stagger-list space-y-3">
                  {continueTrainings.map((training) => (
                    <ContinueCard key={training.id} training={training} />
                  ))}
                </div>
              </div>
            )}

            {recommended.length > 0 && (
              <div className="ey-animate-fade-up" style={{ animationDelay: "120ms" }}>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--ey-yellow))]/15">
                      <Target className="h-3.5 w-3.5 ey-text-accent" aria-hidden="true" />
                    </div>
                    <h2 className="text-base font-bold text-foreground">Recommended for You</h2>
                  </div>
                  <Link
                    href="/"
                    className="flex items-center gap-1 text-xs font-semibold text-[hsl(var(--ey-blue-600))] hover:underline transition-colors"
                  >
                    Browse catalog
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 ey-stagger-grid">
                  {recommended.map((training) => (
                    <RecommendedCard key={training.id} training={training} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN (1/3) ── */}
          <div className="space-y-6">
            <div className="ey-animate-fade-up" style={{ animationDelay: "60ms" }}>
              <ProgressRing
                completionRate={stats.completionRate}
                avgProgress={stats.avgProgress}
                total={enrolledTrainings.length}
                completed={stats.completed.length}
                inProgress={stats.inProgress.length}
              />
            </div>

            {categoryBreakdown.length > 0 && (
              <div className="ey-animate-fade-up" style={{ animationDelay: "180ms" }}>
                <CategoryBreakdown items={categoryBreakdown} />
              </div>
            )}

            <div className="ey-animate-fade-up" style={{ animationDelay: "240ms" }}>
              <AchievementsCard completedCount={stats.completed.length} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
