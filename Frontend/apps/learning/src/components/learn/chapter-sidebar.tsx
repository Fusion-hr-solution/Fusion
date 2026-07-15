"use client";

import { CheckCircle2, Circle, Lock, GraduationCap, ChevronLeft } from "lucide-react";
import { Progress } from "@repo/ui";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ChapterSidebarProps } from "@/types/component-props";

export function ChapterSidebar({
  chapters,
  activeChapterId,
  onSelectChapter,
  trainingTitle,
  overallProgress,
  examAvailable,
  onOpenExam,
  isExamActive,
}: ChapterSidebarProps) {
  const t = useTranslations("learn");
  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="border-b border-border p-5">
        <Link
          href="/my-trainings"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {t("sidebar.backToMyTrainings")}
        </Link>
        <h2 className="text-sm font-bold text-foreground line-clamp-2 leading-snug">
          {trainingTitle}
        </h2>
        <div className="mt-3 flex items-center gap-3">
          <Progress value={overallProgress} className="h-2 flex-1" />
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">
            {overallProgress}%
          </span>
        </div>
      </div>

      {/* Chapter list */}
      <nav className="flex-1 overflow-y-auto py-2" aria-label={t("sidebar.chaptersNavLabel")}>
        <ul className="space-y-0.5 px-2">
          {chapters.map((chapter, i) => {
            const isActive = chapter.id === activeChapterId;
            const isAccessible = i === 0 || chapters[i - 1]!.isCompleted;

            return (
              <li key={chapter.id}>
                <button
                  onClick={() => isAccessible && onSelectChapter(chapter.id)}
                  disabled={!isAccessible}
                  aria-disabled={!isAccessible}
                  className={`group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                    isActive
                      ? "bg-[hsl(var(--ey-blue-500))]/10 border border-[hsl(var(--ey-blue-500))]/20"
                      : isAccessible
                        ? "hover:bg-muted/60"
                        : "opacity-50 cursor-not-allowed"
                  }`}
                >
                  {/* Status icon */}
                  <div className="shrink-0">
                    {chapter.isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-[hsl(var(--ey-green-500))]" aria-hidden="true" />
                    ) : !isAccessible ? (
                      <Lock className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
                    ) : (
                      <Circle
                        className={`h-5 w-5 ${isActive ? "text-[hsl(var(--ey-blue-500))]" : "text-muted-foreground/40"}`}
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  {/* Chapter info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium leading-snug truncate ${
                        isActive
                          ? "text-[hsl(var(--ey-blue-600))]"
                          : chapter.isCompleted
                            ? "text-muted-foreground"
                            : "text-foreground"
                      }`}
                    >
                      {i + 1}. {chapter.title}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {t("sidebar.blocksCount", {
                        completed: chapter.completedBlockCount,
                        total: chapter.blockCount,
                      })}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Exam entry */}
        {examAvailable !== undefined && (
          <div className="border-t border-border mx-2 mt-2 pt-2">
            <button
              onClick={onOpenExam}
              disabled={!examAvailable}
              aria-disabled={!examAvailable}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                isExamActive
                  ? "bg-[hsl(var(--ey-yellow))]/15 border border-[hsl(var(--ey-yellow))]/30"
                  : examAvailable
                    ? "hover:bg-[hsl(var(--ey-yellow))]/10"
                    : "opacity-50 cursor-not-allowed"
              }`}
            >
              <div className="shrink-0">
                {examAvailable ? (
                  <GraduationCap className="h-5 w-5 text-[hsl(var(--ey-yellow))]" aria-hidden="true" />
                ) : (
                  <Lock className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isExamActive ? "text-foreground font-semibold" : examAvailable ? "text-foreground" : "text-muted-foreground"}`}>
                  {t("sidebar.finalExam")}
                </p>
                <span className="text-xs text-muted-foreground">
                  {isExamActive ? t("sidebar.examInProgress") : examAvailable ? t("sidebar.examReady") : t("sidebar.examLocked")}
                </span>
              </div>
            </button>
          </div>
        )}
      </nav>
    </aside>
  );
}
