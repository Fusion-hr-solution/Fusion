"use client";

import { Loader2, AlertCircle } from "lucide-react";
import type { CoursePlayerProps } from "@/types/component-props";
import { useCoursePlayer } from "@/hooks/use-course-player";
import { ChapterSidebar } from "./chapter-sidebar";
import { ChapterContentView } from "./chapter-content-view";
import { ExamLockedBanner } from "./exam-locked-banner";

export function CoursePlayer({ learnData }: CoursePlayerProps) {
  const {
    activeChapterContent,
    activeChapterId,
    activeIndex,
    chapters,
    completedBlockIds,
    completedCount,
    totalCount,
    overallProgress,
    allChaptersCompleted,
    isLoading,
    isLoadingContent,
    contentError,
    setActiveChapterId,
    handleMarkBlockComplete,
    handleNext,
    handlePrevious,
    refetchContent,
  } = useCoursePlayer(learnData);

  const hasExam = Boolean(learnData.training.exam);

  if (chapters.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">This training has no chapters yet.</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-background">
      {/* Chapter sidebar */}
      <ChapterSidebar
        chapters={chapters}
        activeChapterId={activeChapterId}
        onSelectChapter={setActiveChapterId}
        trainingTitle={learnData.training.title}
        overallProgress={overallProgress}
        examAvailable={hasExam && allChaptersCompleted}
        onOpenExam={() => {}}
      />

      {/* Main content area */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Exam banner (when exam exists) */}
        {hasExam && (
          <ExamLockedBanner
            completedCount={completedCount}
            totalCount={totalCount}
            examAvailable={allChaptersCompleted}
            onStartExam={() => {}}
          />
        )}

        {/* Chapter content */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingContent ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          ) : contentError ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-center max-w-sm px-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">Failed to load chapter</p>
                  <p className="text-sm text-muted-foreground">
                    {contentError.message || "Something went wrong. Please try again."}
                  </p>
                </div>
                <button
                  onClick={refetchContent}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : !activeChapterContent ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          ) : (
            <ChapterContentView
              chapter={activeChapterContent}
              completedBlockIds={completedBlockIds}
              isLast={activeIndex === totalCount - 1}
              onMarkBlockComplete={handleMarkBlockComplete}
              onNext={handleNext}
              onPrevious={handlePrevious}
              hasPrevious={activeIndex > 0}
              isLoading={isLoading}
            />
          )}
        </div>
      </main>
    </div>
  );
}
