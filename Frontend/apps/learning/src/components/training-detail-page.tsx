import { Button } from "@repo/ui";
import { CalendarDays, ChevronRight } from "lucide-react";
import type { TrainingDetailPageProps } from "@/types/component-props";
import {
  TrainingDetailBanner,
  TrainingStatsGrid,
  ChapterList,
  ExamSection,
  InstructorCard,
  TrainingTagsCard,
} from "./training-detail";

export function TrainingDetailPage({ training }: TrainingDetailPageProps) {
  return (
    <div className="min-h-full">
      <TrainingDetailBanner training={training} />

      {/* ── Body ── */}
      <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
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
                <CalendarDays
                  className="h-4 w-4"
                  aria-hidden="true"
                />
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
