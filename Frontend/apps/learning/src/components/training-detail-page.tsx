import { Button } from "@repo/ui";
import { CalendarDays, ChevronRight, AlertTriangle, Award } from "lucide-react";
import type { TrainingDetailPageProps } from "@/types/component-props";
import { CATEGORY_CONFIG, LEVEL_CONFIG } from "@/data/categories";
import { BADGE_LEVEL_CONFIG } from "@/data/badge-config";
import { PageHeader } from "./page-header";
import { PageBreadcrumb } from "./page-breadcrumb";
import {
  TrainingStatsGrid,
  ChapterList,
  ExamSection,
  InstructorCard,
  TrainingTagsCard,
} from "./training-detail";

export function TrainingDetailPage({ training }: TrainingDetailPageProps) {
  const category = CATEGORY_CONFIG[training.category];
  const level = LEVEL_CONFIG[training.level];
  const badge = BADGE_LEVEL_CONFIG[training.badgeLevel];

  return (
    <div className="min-h-full">
      <PageBreadcrumb
        backHref="/"
        backLabel="Back"
        items={[
          { label: "Catalog", href: "/" },
          { label: training.title },
        ]}
      />
      <PageHeader
        moduleTitle="Training Details"
        title={training.title}
        description={training.description}
      >
        {/* Badges row */}
        <div
          className="ey-animate-fade-up mt-4 flex items-center gap-3 flex-wrap"
          style={{ animationDelay: "200ms" }}
        >
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase ${category.badgeClass}`}
          >
            {category.label}
          </span>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${level.dotClass}`} />
            {level.label}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
          >
            <Award className="h-3 w-3" aria-hidden="true" />
            {badge.label}
          </span>
          {training.isMandatory && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              Mandatory
            </span>
          )}
        </div>
      </PageHeader>

      {/* ── Body ── */}
      <div className="px-8 py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* ── Left column ── */}
          <div className="space-y-8">
            <TrainingStatsGrid training={training} />
            <ChapterList
              chapters={training.chapters}
              chaptersCount={training.chaptersCount}
            />
            <ExamSection
              exam={training.exam}
              chaptersCount={training.chaptersCount}
            />
          </div>

          {/* ── Right column / Sidebar ── */}
          <aside className="space-y-6">
            <InstructorCard
              name={training.instructor}
              role={training.instructorRole}
            />
            <TrainingTagsCard tags={training.tags} />

            {/* Updated date */}
            <div
              className="ey-animate-fade-up rounded-2xl border border-border/50 bg-white p-6"
              style={{ animationDelay: "300ms" }}
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                <span>
                  Last updated{" "}
                  {new Date(
                    training.updatedAt + "T00:00:00"
                  ).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>

            {/* CTA */}
            <div
              className="ey-animate-fade-up sticky top-6"
              style={{ animationDelay: "350ms" }}
            >
              <Button className="w-full ey-bg-dark hover:ey-bg-dark-deep text-white gap-2 shadow-lg transition-all hover:shadow-xl hover:gap-3 h-12 text-sm font-semibold">
                Enroll Now
                <ChevronRight
                  className="h-4 w-4 transition-transform"
                  aria-hidden="true"
                />
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
