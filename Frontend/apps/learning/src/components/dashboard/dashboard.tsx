"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  BookOpen,
  GraduationCap,
  Clock,
  CheckCircle2,
  TrendingUp,
  Target,
  Flame,
  ChevronRight,
  Play,
  Award,
  BarChart3,
  Zap,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent } from "@repo/ui";
import type { Training, EnrolledTraining, TrainingCategory } from "@/types";
import { CATEGORY_CONFIG } from "@/data/categories";
import { STATUS_CONFIG } from "@/data/status-config";

interface DashboardProps {
  trainings: Training[];
  enrolledTrainings: EnrolledTraining[];
}

export function Dashboard({ trainings, enrolledTrainings }: DashboardProps) {
  const stats = useMemo(() => {
    const inProgress = enrolledTrainings.filter(
      (t) => t.status === "in-progress"
    );
    const completed = enrolledTrainings.filter(
      (t) => t.status === "completed"
    );
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
        ? Math.round(
            inProgress.reduce((sum, t) => sum + t.progress, 0) /
              inProgress.length
          )
        : 0;

    return {
      inProgress,
      completed,
      totalHours,
      completedHours,
      completionRate,
      avgProgress,
    };
  }, [enrolledTrainings]);

  // Category distribution
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

  // Recent activity — last 3 in-progress
  const continueTrainings = stats.inProgress
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 3);

  // Recommended — courses not enrolled
  const enrolledIds = new Set(enrolledTrainings.map((t) => t.id));
  const recommended = trainings
    .filter((t) => !enrolledIds.has(t.id))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 4);

  return (
    <>
      {/* ── Hero banner ── */}
      <section className="relative overflow-hidden border-b border-border/50 bg-white">
        <div className="ey-hero-pattern absolute inset-0 opacity-30" />
        <div className="absolute right-0 top-0 h-full w-2/5 bg-gradient-to-l from-[hsl(var(--ey-yellow))]/5 to-transparent" />
        {/* Decorative corner accent */}
        <div className="absolute right-8 top-8 h-20 w-20 rounded-full bg-[hsl(var(--ey-yellow))]/8 blur-2xl" />

        <div className="relative mx-auto max-w-7xl px-6 py-10 lg:py-12">
          <div className="ey-animate-fade-up flex items-end gap-3 mb-1">
            <div className="flex h-9 w-1 rounded-full ey-bg-accent" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Learning Dashboard
            </span>
          </div>

          <div className="flex items-start justify-between gap-6">
            <div>
              <h1
                className="ey-animate-fade-up mt-3 text-3xl font-bold tracking-tight text-foreground lg:text-4xl"
                style={{ animationDelay: "80ms" }}
              >
                Welcome back
              </h1>
              <p
                className="ey-animate-fade-up mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground"
                style={{ animationDelay: "160ms" }}
              >
                Here&apos;s your learning journey at a glance. Keep pushing —
                you&apos;re making great progress.
              </p>
            </div>

            {/* Streak / highlight card */}
            <div
              className="ey-animate-fade-up hidden lg:flex items-center gap-3.5 rounded-xl border border-border/60 bg-[hsl(var(--ey-grey-50))] px-5 py-3.5 shadow-sm"
              style={{ animationDelay: "240ms" }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--ey-yellow))]/15">
                <Flame className="h-5 w-5 ey-text-accent" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground leading-none">
                  7-day streak
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Keep it up!
                </p>
              </div>
            </div>
          </div>

          {/* ── KPI cards row ── */}
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {[
              {
                icon: BookOpen,
                value: stats.inProgress.length,
                label: "In Progress",
                accent: "bg-[hsl(var(--ey-blue-400))]/8",
                iconColor: "text-[hsl(var(--ey-blue-400))]",
                ringColor: "ring-[hsl(var(--ey-blue-400))]/20",
              },
              {
                icon: CheckCircle2,
                value: stats.completed.length,
                label: "Completed",
                accent: "bg-[hsl(var(--ey-green-500))]/8",
                iconColor: "text-[hsl(var(--ey-green-500))]",
                ringColor: "ring-[hsl(var(--ey-green-500))]/20",
              },
              {
                icon: Clock,
                value: `${stats.completedHours}h`,
                label: "Hours Learned",
                accent: "bg-[hsl(var(--ey-orange-500))]/8",
                iconColor: "text-[hsl(var(--ey-orange-500))]",
                ringColor: "ring-[hsl(var(--ey-orange-500))]/20",
              },
              {
                icon: TrendingUp,
                value: `${stats.completionRate}%`,
                label: "Completion Rate",
                accent: "bg-[hsl(var(--ey-yellow))]/10",
                iconColor: "ey-text-accent",
                ringColor: "ring-[hsl(var(--ey-yellow))]/30",
              },
            ].map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <div
                  key={kpi.label}
                  className={`ey-animate-fade-up group flex items-center gap-3.5 rounded-xl border border-border/60 bg-white px-4 py-4 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5`}
                  style={{ animationDelay: `${280 + i * 60}ms` }}
                >
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${kpi.accent} ring-1 ${kpi.ringColor} transition-transform duration-300 group-hover:scale-105`}
                  >
                    <Icon
                      className={`h-5 w-5 ${kpi.iconColor}`}
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground leading-none tabular-nums">
                      {kpi.value}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {kpi.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Dashboard grid ── */}
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── LEFT COLUMN (2/3) ── */}
          <div className="space-y-6 lg:col-span-2">
            {/* Continue Learning */}
            {continueTrainings.length > 0 && (
              <div className="ey-animate-fade-up">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg ey-bg-dark">
                      <Zap
                        className="h-3.5 w-3.5 text-white"
                        aria-hidden="true"
                      />
                    </div>
                    <h2 className="text-base font-bold text-foreground">
                      Continue Learning
                    </h2>
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

            {/* Recommended for You */}
            {recommended.length > 0 && (
              <div
                className="ey-animate-fade-up"
                style={{ animationDelay: "120ms" }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--ey-yellow))]/15">
                      <Target
                        className="h-3.5 w-3.5 ey-text-accent"
                        aria-hidden="true"
                      />
                    </div>
                    <h2 className="text-base font-bold text-foreground">
                      Recommended for You
                    </h2>
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
            {/* Progress Overview Ring */}
            <div
              className="ey-animate-fade-up"
              style={{ animationDelay: "60ms" }}
            >
              <ProgressRing
                completionRate={stats.completionRate}
                avgProgress={stats.avgProgress}
                total={enrolledTrainings.length}
                completed={stats.completed.length}
                inProgress={stats.inProgress.length}
              />
            </div>

            {/* Category Breakdown */}
            {categoryBreakdown.length > 0 && (
              <div
                className="ey-animate-fade-up"
                style={{ animationDelay: "180ms" }}
              >
                <CategoryBreakdown items={categoryBreakdown} />
              </div>
            )}

            {/* Achievements */}
            <div
              className="ey-animate-fade-up"
              style={{ animationDelay: "240ms" }}
            >
              <AchievementsCard completedCount={stats.completed.length} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ─────────────────────────── Sub-components ─────────────────────────── */

function ContinueCard({ training }: { training: EnrolledTraining }) {
  const category = CATEGORY_CONFIG[training.category];
  const status = STATUS_CONFIG[training.status];
  const StatusIcon = status.icon;

  return (
    <Card className="group overflow-hidden border border-border/60 bg-white transition-all duration-300 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5">
      <div className={`h-1 w-full ey-animate-stripe ${category.stripClass}`} />
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Progress ring */}
          <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center">
            <svg className="h-14 w-14 -rotate-90" viewBox="0 0 48 48">
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="hsl(var(--ey-grey-200))"
                strokeWidth="3"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="hsl(var(--ey-blue-400))"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${(training.progress / 100) * 125.6} 125.6`}
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <span className="absolute text-xs font-bold text-foreground tabular-nums">
              {training.progress}%
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${category.badgeClass}`}
              >
                {category.label}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.className}`}
              >
                <StatusIcon className="h-2.5 w-2.5" aria-hidden="true" />
                {status.label}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-[hsl(var(--ey-blue-600))] transition-colors">
              {training.title}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Chapter {training.currentChapter} of {training.chaptersCount} ·{" "}
              {training.duration}
            </p>
          </div>

          {/* Action */}
          <button
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ey-bg-dark text-white shadow-sm transition-all duration-300 hover:bg-[hsl(var(--ey-black))] hover:shadow-md hover:scale-105"
            aria-label={`Continue ${training.title}`}
          >
            <Play className="h-3.5 w-3.5 ml-0.5" aria-hidden="true" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function RecommendedCard({ training }: { training: Training }) {
  const category = CATEGORY_CONFIG[training.category];

  return (
    <Card className="group relative flex flex-col overflow-hidden border border-border/60 bg-white transition-all duration-300 hover:shadow-xl hover:shadow-black/8 hover:-translate-y-1 cursor-pointer">
      <div className={`h-1 w-full ey-animate-stripe ${category.stripClass}`} />
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${category.badgeClass}`}
          >
            {category.label}
          </span>
          <ArrowUpRight
            className="h-3.5 w-3.5 text-muted-foreground/0 transition-all duration-300 group-hover:text-[hsl(var(--ey-blue-600))] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden="true"
          />
        </div>

        <h3 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-[hsl(var(--ey-blue-600))] transition-colors">
          {training.title}
        </h3>

        <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2 flex-1">
          {training.description}
        </p>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/40">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {training.duration}
          </span>
          <span className="flex items-center gap-1.5">
            <BookOpen className="h-3 w-3" aria-hidden="true" />
            {training.chaptersCount} chapters
          </span>
          <span className="flex items-center gap-1 font-semibold text-foreground">
            ★ {training.rating}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressRing({
  completionRate,
  avgProgress,
  total,
  completed,
  inProgress,
}: {
  completionRate: number;
  avgProgress: number;
  total: number;
  completed: number;
  inProgress: number;
}) {
  const circumference = 2 * Math.PI * 54;
  const completedStroke = (completed / Math.max(total, 1)) * circumference;
  const inProgressStroke = (inProgress / Math.max(total, 1)) * circumference;

  return (
    <Card className="overflow-hidden border border-border/60 bg-white">
      <div className="h-1 w-full ey-bg-accent ey-animate-stripe" />
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--ey-green-500))]/10">
            <BarChart3
              className="h-3.5 w-3.5 text-[hsl(var(--ey-green-500))]"
              aria-hidden="true"
            />
          </div>
          <h3 className="text-sm font-bold text-foreground">
            Progress Overview
          </h3>
        </div>

        {/* Ring chart */}
        <div className="flex justify-center mb-5">
          <div className="relative">
            <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
              {/* Background */}
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="hsl(var(--ey-grey-200))"
                strokeWidth="8"
              />
              {/* Completed arc */}
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="hsl(var(--ey-green-500))"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${completedStroke} ${circumference}`}
                className="transition-all duration-1000 ease-out"
              />
              {/* In-progress arc */}
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="hsl(var(--ey-blue-400))"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${inProgressStroke} ${circumference}`}
                strokeDashoffset={`-${completedStroke}`}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-foreground tabular-nums leading-none">
                {completionRate}%
              </span>
              <span className="text-[10px] text-muted-foreground mt-1">
                Complete
              </span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--ey-green-500))]" />
              <span className="text-muted-foreground">Completed</span>
            </div>
            <span className="font-bold text-foreground tabular-nums">
              {completed}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--ey-blue-400))]" />
              <span className="text-muted-foreground">In Progress</span>
            </div>
            <span className="font-bold text-foreground tabular-nums">
              {inProgress}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--ey-grey-300))]" />
              <span className="text-muted-foreground">Not Started</span>
            </div>
            <span className="font-bold text-foreground tabular-nums">
              {total - completed - inProgress}
            </span>
          </div>
        </div>

        {/* Avg progress bar */}
        {inProgress > 0 && (
          <div className="mt-4 pt-4 border-t border-border/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">
                Avg. Progress
              </span>
              <span className="text-xs font-bold text-foreground tabular-nums">
                {avgProgress}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-[hsl(var(--ey-grey-200))] overflow-hidden">
              <div
                className="h-full rounded-full bg-[hsl(var(--ey-blue-400))] transition-all duration-700 ease-out"
                style={{ width: `${avgProgress}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryBreakdown({
  items,
}: {
  items: {
    category: TrainingCategory;
    count: number;
    percentage: number;
  }[];
}) {
  return (
    <Card className="overflow-hidden border border-border/60 bg-white">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10">
            <GraduationCap
              className="h-3.5 w-3.5 text-purple-500"
              aria-hidden="true"
            />
          </div>
          <h3 className="text-sm font-bold text-foreground">
            Learning by Category
          </h3>
        </div>

        <div className="space-y-3.5">
          {items.map((item) => {
            const config = CATEGORY_CONFIG[item.category];
            return (
              <div key={item.category}>
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${config.badgeClass}`}
                  >
                    {config.label}
                  </span>
                  <span className="text-xs font-bold text-foreground tabular-nums">
                    {item.count}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[hsl(var(--ey-grey-200))] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${config.stripClass} transition-all duration-700 ease-out`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function AchievementsCard({ completedCount }: { completedCount: number }) {
  const badges = [
    {
      name: "First Steps",
      description: "Complete your first training",
      unlocked: completedCount >= 1,
      icon: Zap,
    },
    {
      name: "Quick Learner",
      description: "Complete 3 trainings",
      unlocked: completedCount >= 3,
      icon: Flame,
    },
    {
      name: "Knowledge Seeker",
      description: "Complete 5 trainings",
      unlocked: completedCount >= 5,
      icon: Award,
    },
    {
      name: "Master Scholar",
      description: "Complete 10 trainings",
      unlocked: completedCount >= 10,
      icon: GraduationCap,
    },
  ];

  return (
    <Card className="overflow-hidden border border-border/60 bg-white">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--ey-yellow))]/15">
            <Award
              className="h-3.5 w-3.5 ey-text-accent"
              aria-hidden="true"
            />
          </div>
          <h3 className="text-sm font-bold text-foreground">Achievements</h3>
        </div>

        <div className="space-y-3">
          {badges.map((badge) => {
            const Icon = badge.icon;
            return (
              <div
                key={badge.name}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  badge.unlocked
                    ? "bg-[hsl(var(--ey-yellow))]/8"
                    : "bg-[hsl(var(--ey-grey-100))]"
                }`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    badge.unlocked
                      ? "ey-bg-accent"
                      : "bg-[hsl(var(--ey-grey-200))]"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${
                      badge.unlocked
                        ? "text-[hsl(var(--ey-grey-500))]"
                        : "text-[hsl(var(--ey-grey-400))]"
                    }`}
                    aria-hidden="true"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs font-semibold ${
                      badge.unlocked
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {badge.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">
                    {badge.description}
                  </p>
                </div>
                {badge.unlocked && (
                  <CheckCircle2
                    className="h-4 w-4 text-[hsl(var(--ey-green-500))] flex-shrink-0"
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
