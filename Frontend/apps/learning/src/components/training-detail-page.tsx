"use client";

import { CalendarDays, AlertTriangle, Award } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { TrainingDetailPageProps } from "@/types/component-props";
import { CATEGORY_CONFIG, LEVEL_CONFIG } from "@/data/categories";
import { BADGE_LEVEL_CONFIG } from "@/data/badge-config";
import { PageHeader } from "./page-header";
import { PageBreadcrumb } from "./page-breadcrumb";
import { TrainingStatsGrid, ChapterList, ExamSection, InstructorCard, TrainingTagsCard, OnSiteCoursesList, SessionEnrollmentPanel } from "./training-detail";
import { TrainingEnrollCta } from "./training-enroll-cta";

export function TrainingDetailPage({ training }: TrainingDetailPageProps) {
  const t = useTranslations("trainingDetail");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const category = CATEGORY_CONFIG[training.category];
  const level = LEVEL_CONFIG[training.level];
  const badge = BADGE_LEVEL_CONFIG[training.badgeLevel];

  return (
    <div className="min-h-full">
      <PageBreadcrumb backHref="/" backLabel={tCommon("actions.back")} items={[{ label: t("breadcrumb.catalog"), href: "/" }, { label: training.title }]} />
      <PageHeader moduleTitle={t("header.moduleTitle")} title={training.title} description={training.description}>
        <div className="ey-animate-fade-up mt-4 flex items-center gap-3 flex-wrap" style={{ animationDelay: "200ms" }}>
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase ${category.badgeClass}`}>{tCommon(`category.${training.category}`)}</span>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><span className={`h-2 w-2 rounded-full ${level.dotClass}`} />{tCommon(`level.${training.level}`)}</span>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}><Award className="h-3 w-3" aria-hidden="true" />{tCommon(`badgeLevel.${training.badgeLevel.toLowerCase()}`)}</span>
          {training.isMandatory && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--ey-orange-500))]/10 border border-[hsl(var(--ey-orange-500))]/20 px-2.5 py-0.5 text-xs font-semibold text-[hsl(var(--ey-orange-500))]"><AlertTriangle className="h-3 w-3" aria-hidden="true" />{t("mandatory")}</span>
          )}
          {training.trainingType === "OnSite" && (
            <span className="inline-flex items-center rounded-full bg-[hsl(var(--ey-teal-500))]/10 border border-[hsl(var(--ey-teal-500))]/20 px-2.5 py-0.5 text-xs font-semibold text-[hsl(var(--ey-teal-500))]">{t("onSiteTraining")}</span>
          )}
        </div>
      </PageHeader>

      <div className="px-8 py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="space-y-8">
            <TrainingStatsGrid training={training} />
            {training.trainingType === "OnSite" ? (
              <>
                <SessionEnrollmentPanel trainingId={training.id} />
                <OnSiteCoursesList courses={training.onSiteCourses ?? []} scheduledDate={training.scheduledDate} />
              </>
            ) : (
              <>
                <ChapterList chapters={training.chapters} chaptersCount={training.chaptersCount} />
                <ExamSection exam={training.exam} chaptersCount={training.chaptersCount} />
              </>
            )}
          </div>

          <aside className="space-y-6">
            <InstructorCard name={training.instructor} role={training.instructorRole} />
            <TrainingTagsCard tags={training.tags} />
            <div className="ey-animate-fade-up rounded-2xl border border-border/50 bg-card p-6" style={{ animationDelay: "300ms" }}>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                <span>{t("lastUpdated", { date: format.dateTime(new Date(training.updatedAt + "T00:00:00Z"), { month: "long", day: "numeric", year: "numeric" }) })}</span>
              </div>
            </div>
            <div className="ey-animate-fade-up sticky top-6" style={{ animationDelay: "350ms" }}>
              <TrainingEnrollCta trainingId={training.id} trainingType={training.trainingType} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
