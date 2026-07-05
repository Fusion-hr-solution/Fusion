"use client";

import {
  BookOpen,
  Clock,
  CheckCircle2,
  TrendingUp,
  Target,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { DashboardProps } from "@/types/component-props";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { PageHeader } from "../page-header";
import { KpiCard } from "../kpi-card";
import { SectionHeader } from "../section-header";
import { ContinueCard } from "./continue-card";
import { RecommendedCard } from "./recommended-card";
import { ProgressRing } from "./progress-ring";
import { CategoryBreakdown } from "./category-breakdown";
import { AchievementsCard } from "./achievements-card";
import { InPersonHoursWidget } from "./in-person-hours-widget";
import { FeedbackPrompt } from "../feedback";

export function Dashboard({ enrolledTrainings, recommendations }: DashboardProps) {
  const t = useTranslations("dashboard");
  const { stats, categoryBreakdown, continueTrainings } =
    useDashboardData(enrolledTrainings);

  return (
    <>
      <PageHeader
        moduleTitle={t("moduleTitle")}
        title={t("title")}
        description={t("description")}
      >
        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {[
            {
              icon: BookOpen,
              value: stats.inProgress.length,
              label: t("kpi.inProgress"),
            },
            {
              icon: CheckCircle2,
              value: stats.completed.length,
              label: t("kpi.completed"),
            },
            {
              icon: Clock,
              value: `${stats.completedHours}h`,
              label: t("kpi.hoursLearned"),
            },
            {
              icon: TrendingUp,
              value: `${stats.completionRate}%`,
              label: t("kpi.completionRate"),
            },
          ].map((kpi, i) => (
            <KpiCard
              key={kpi.label}
              icon={kpi.icon}
              value={kpi.value}
              label={kpi.label}
              index={i}
              delayBase={280}
            />
          ))}
        </div>
      </PageHeader>

      {/* ── Dashboard grid ── */}
      <section className="px-8 py-8 space-y-6">
        <div className="ey-animate-fade-up">
          <InPersonHoursWidget />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── LEFT COLUMN (2/3) ── */}
          <div className="space-y-6 lg:col-span-2">
            {continueTrainings.length > 0 && (
              <div className="ey-animate-fade-up">
                <SectionHeader
                  icon={Zap}
                  title={t("continueLearning")}
                  linkHref="/my-trainings"
                  linkLabel={t("viewAll")}
                />

                <div className="ey-stagger-list space-y-3">
                  {continueTrainings.map((training) => (
                    <ContinueCard key={training.id} training={training} />
                  ))}
                </div>
              </div>
            )}

            {recommendations.length > 0 && (
              <div
                className="ey-animate-fade-up"
                style={{ animationDelay: "120ms" }}
              >
                <SectionHeader
                  icon={Target}
                  iconClassName="bg-[hsl(var(--ey-yellow))]/15"
                  iconColorClassName="text-muted-foreground"
                  title={t("recommended")}
                  linkHref="/"
                  linkLabel={t("browseCatalog")}
                />

                <div className="grid gap-3 sm:grid-cols-2 ey-stagger-grid">
                  {recommendations.map((rec) => (
                    <RecommendedCard
                      key={rec.training.id}
                      training={rec.training}
                      reason={rec.reason}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN (1/3) ── */}
          <div className="space-y-6">
            <div className="ey-animate-fade-up">
              <FeedbackPrompt />
            </div>

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

            {categoryBreakdown.length > 0 && (
              <div
                className="ey-animate-fade-up"
                style={{ animationDelay: "180ms" }}
              >
                <CategoryBreakdown items={categoryBreakdown} />
              </div>
            )}

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
