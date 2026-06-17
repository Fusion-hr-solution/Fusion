"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Calendar, Download, ExternalLink } from "lucide-react";
import { Button, Card, CardContent } from "@repo/ui";
import { useFormatter, useTranslations } from "next-intl";
import type { Training } from "@/types";

interface OnSiteLearnViewProps {
  training: Training;
}

export function OnSiteLearnView({ training }: OnSiteLearnViewProps) {
  const t = useTranslations("learn.onsite");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const router = useRouter();
  const [selectedCourseIndex, setSelectedCourseIndex] = useState(0);
  const courses = (training.onSiteCourses ?? []).sort(
    (a, b) => a.orderIndex - b.orderIndex
  );
  const selectedCourse = courses[selectedCourseIndex];

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top Bar */}
      <header className="flex items-center gap-4 border-b border-border px-4 py-3 bg-card">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            router.push(
              `/training/${encodeURIComponent(training.id)}`
            )
          }
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {tCommon("actions.back")}
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate">{training.title}</h1>
          {training.scheduledDate && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {format.dateTime(new Date(training.scheduledDate), {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — course list */}
        <aside className="w-72 shrink-0 border-r border-border bg-card overflow-y-auto">
          <div className="p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {t("courseMaterials", { count: courses.length })}
            </h2>
            <div className="space-y-1">
              {courses.map((course, index) => (
                <button
                  key={course.id}
                  onClick={() => setSelectedCourseIndex(index)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    index === selectedCourseIndex
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <FileText className="h-4 w-4 shrink-0 text-red-500" />
                  <span className="truncate">{course.title}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main content — PDF viewer */}
        <main className="flex-1 overflow-hidden">
          {selectedCourse ? (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium">{selectedCourse.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={selectedCourse.contentUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {t("open")}
                  </a>
                  <a
                    href={selectedCourse.contentUri}
                    download
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <Download className="h-3 w-3" />
                    {tCommon("actions.download")}
                  </a>
                </div>
              </div>
              <iframe
                src={selectedCourse.contentUri}
                className="flex-1 w-full border-0"
                title={selectedCourse.title}
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center py-12 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t("noMaterials")}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
