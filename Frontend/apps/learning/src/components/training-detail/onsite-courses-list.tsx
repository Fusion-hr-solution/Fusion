"use client";

import { FileText, Calendar } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { OnSiteCourse } from "@/types";

interface OnSiteCoursesListProps {
  courses: OnSiteCourse[];
  scheduledDate?: string;
}

export function OnSiteCoursesList({ courses, scheduledDate }: OnSiteCoursesListProps) {
  const t = useTranslations("trainingDetail.onsite");
  const format = useFormatter();
  const sorted = [...courses].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="ey-animate-fade-up space-y-4" style={{ animationDelay: "280ms" }}>
      {scheduledDate && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <Calendar className="h-5 w-5 text-blue-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-900">{t("scheduledSession")}</p>
            <p className="text-sm text-blue-700">
              {t("scheduledAt", {
                date: format.dateTime(new Date(scheduledDate), {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }),
                time: format.dateTime(new Date(scheduledDate), {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })}
            </p>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("materialsTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("materialsCount", { count: sorted.length })}
        </p>
      </div>

      <div className="space-y-2">
        {sorted.map((course, index) => (
          <div
            key={course.id}
            className="flex items-center gap-3 rounded-xl border border-border/50 bg-white p-4 transition-all hover:shadow-md hover:shadow-black/5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100">
              <FileText className="h-4 w-4 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{course.title}</p>
              <p className="text-xs text-muted-foreground">{t("materialIndex", { index: index + 1 })}</p>
            </div>
          </div>
        ))}
      </div>

      {sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">
            {t("noMaterials")}
          </p>
        </div>
      )}
    </div>
  );
}
