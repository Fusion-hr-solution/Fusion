"use client";

import { useMemo } from "react";

import {
  BookOpen,
  Clock,
  CheckCircle2,
  TrendingUp,
  Target,
  Zap,
} from "lucide-react";
import type { TrainingCategory } from "@/types";
import type { DashboardProps } from "@/types/component-props";
import { PageHeader } from "../page-header";
import { KpiCard } from "../kpi-card";
import { SectionHeader } from "../section-header";
import { ContinueCard } from "./continue-card";
import { RecommendedCard } from "./recommended-card";
import { ProgressRing } from "./progress-ring";
import { CategoryBreakdown } from "./category-breakdown";
import { AchievementsCard } from "./achievements-card";

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
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {[
              { icon: BookOpen, value: stats.inProgress.length, label: "In Progress" },
              { icon: CheckCircle2, value: stats.completed.length, label: "Completed" },
              { icon: Clock, value: `${stats.completedHours}h`, label: "Hours Learned" },
              { icon: TrendingUp, value: `${stats.completionRate}%`, label: "Completion Rate" },
            ].map((kpi, i) => (
              <KpiCard key={kpi.label} icon={kpi.icon} value={kpi.value} label={kpi.label} index={i} delayBase={280} />
            ))}
          </div>
      </PageHeader>

      {/* ── Dashboard grid ── */}
      <section className="px-8 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── LEFT COLUMN (2/3) ── */}
          <div className="space-y-6 lg:col-span-2">
            {continueTrainings.length > 0 && (
              <div className="ey-animate-fade-up">
                <SectionHeader
                  icon={Zap}
                  title="Continue Learning"
                  linkHref="/my-trainings"
                  linkLabel="View all"
                />

                <div className="ey-stagger-list space-y-3">
                  {continueTrainings.map((training) => (
                    <ContinueCard key={training.id} training={training} />
                  ))}
                </div>
              </div>
            )}

            {recommended.length > 0 && (
              <div className="ey-animate-fade-up" style={{ animationDelay: "120ms" }}>
                <SectionHeader
                  icon={Target}
                  iconClassName="bg-[hsl(var(--ey-yellow))]/15"
                  iconColorClassName="text-[hsl(var(--ey-grey-600))]"
                  title="Recommended for You"
                  linkHref="/"
                  linkLabel="Browse catalog"
                />

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
