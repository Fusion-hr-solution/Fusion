"use client";

import { Loader2 } from "lucide-react";
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
    setActiveChapterId,
    handleMarkBlockComplete,
    handleNext,
    handlePrevious,
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
          {isLoadingContent || !activeChapterContent ? (
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
