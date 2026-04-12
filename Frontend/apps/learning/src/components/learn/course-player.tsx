"use client";

import type { CoursePlayerProps } from "@/types/component-props";
import { useCoursePlayer } from "@/hooks/use-course-player";
import { ChapterSidebar } from "./chapter-sidebar";
import { ChapterContentView } from "./chapter-content-view";
import { ExamLockedBanner } from "./exam-locked-banner";

export function CoursePlayer({ learnData }: CoursePlayerProps) {
  const {
    activeChapter,
    activeChapterId,
    activeIndex,
    chapterProgress,
    completedSet,
    completedCount,
    totalCount,
    overallProgress,
    allChaptersCompleted,
    isLoading,
    setActiveChapterId,
    handleMarkComplete,
    handleNext,
    handlePrevious,
  } = useCoursePlayer(learnData);

  const hasExam = Boolean(learnData.training.exam);

  if (!activeChapter) {
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
        chapters={learnData.chapters}
        chapterProgress={chapterProgress}
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
          <ChapterContentView
            chapter={activeChapter}
            isCompleted={completedSet.has(activeChapter.id)}
            isLast={activeIndex === totalCount - 1}
            onMarkComplete={handleMarkComplete}
            onNext={handleNext}
            onPrevious={handlePrevious}
            hasPrevious={activeIndex > 0}
            isLoading={isLoading}
          />
        </div>
      </main>
    </div>
  );
}
