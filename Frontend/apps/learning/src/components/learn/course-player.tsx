"use client";

import { useState, useCallback } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import type { CoursePlayerProps } from "@/types/component-props";
import { useCoursePlayer } from "@/hooks/use-course-player";
import { useExamPlayer } from "@/hooks/use-exam-player";
import { ChapterSidebar } from "./chapter-sidebar";
import { ChapterContentView } from "./chapter-content-view";
import { ExamLockedBanner } from "./exam-locked-banner";
import { ExamTakingView } from "./exam-taking-view";

export function CoursePlayer({ learnData }: CoursePlayerProps) {
  const [showExam, setShowExam] = useState(false);

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

  const hasExam = (learnData.training.exam?.questionsCount ?? 0) > 0;
  const examAvailable = hasExam && allChaptersCompleted;

  const examPlayer = useExamPlayer(learnData.training.id);

  const handleOpenExam = useCallback(() => {
    setShowExam(true);
    examPlayer.loadExam();
  }, [examPlayer]);

  const handleBackFromExam = useCallback(() => {
    setShowExam(false);
  }, []);

  if (chapters.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">This training has no chapters yet.</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-background">
      <ChapterSidebar
        chapters={chapters}
        activeChapterId={showExam ? "" : activeChapterId}
        onSelectChapter={(id) => { setShowExam(false); setActiveChapterId(id); }}
        trainingTitle={learnData.training.title}
        overallProgress={overallProgress}
        examAvailable={examAvailable}
        onOpenExam={handleOpenExam}
        isExamActive={showExam}
      />

      <main className="flex flex-1 flex-col overflow-hidden">
        {hasExam && !showExam && (
          <ExamLockedBanner
            completedCount={completedCount}
            totalCount={totalCount}
            examAvailable={allChaptersCompleted}
            onStartExam={handleOpenExam}
          />
        )}

        <div className="flex-1 overflow-y-auto">
          {showExam ? (
            <ExamPlayerContent examPlayer={examPlayer} onBack={handleBackFromExam} />
          ) : (
            <ChapterContent
              activeChapterContent={activeChapterContent}
              isLoadingContent={isLoadingContent}
              contentError={contentError}
              refetchContent={refetchContent}
              completedBlockIds={completedBlockIds}
              activeIndex={activeIndex}
              totalCount={totalCount}
              handleMarkBlockComplete={handleMarkBlockComplete}
              handleNext={handleNext}
              handlePrevious={handlePrevious}
              isLoading={isLoading}
              examAvailable={examAvailable}
              onStartExam={handleOpenExam}
            />
          )}
        </div>
      </main>
    </div>
  );
}

/* ── Extracted sub-components to keep CoursePlayer lean ── */

function ExamPlayerContent({
  examPlayer,
  onBack,
}: {
  examPlayer: ReturnType<typeof useExamPlayer>;
  onBack: () => void;
}) {
  if (examPlayer.phase === "loading" || examPlayer.isLoadingExam) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (examPlayer.examError || !examPlayer.exam) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm px-4">
          <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Failed to load exam. You may need to complete all chapters first.
          </p>
          <button
            onClick={onBack}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            Back to chapters
          </button>
        </div>
      </div>
    );
  }

  return (
    <ExamTakingView
      exam={examPlayer.exam}
      attempts={examPlayer.attempts}
      phase={examPlayer.phase}
      result={examPlayer.result}
      answers={examPlayer.answers}
      onSetAnswer={examPlayer.setAnswer}
      onStart={examPlayer.startExam}
      onSubmit={examPlayer.handleSubmit}
      onRetry={examPlayer.retryExam}
      onBack={onBack}
      isSubmitting={examPlayer.isSubmitting}
    />
  );
}

function ChapterContent({
  activeChapterContent,
  isLoadingContent,
  contentError,
  refetchContent,
  completedBlockIds,
  activeIndex,
  totalCount,
  handleMarkBlockComplete,
  handleNext,
  handlePrevious,
  isLoading,
  examAvailable,
  onStartExam,
}: {
  activeChapterContent: ReturnType<typeof useCoursePlayer>["activeChapterContent"];
  isLoadingContent: boolean;
  contentError: unknown;
  refetchContent: () => void;
  completedBlockIds: Set<string>;
  activeIndex: number;
  totalCount: number;
  handleMarkBlockComplete: (blockId: string) => void;
  handleNext: () => void;
  handlePrevious: () => void;
  isLoading: boolean;
  examAvailable: boolean;
  onStartExam: () => void;
}) {
  if (isLoadingContent) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (contentError) {
    const errorMsg = contentError instanceof Error ? contentError.message : "Something went wrong. Please try again.";
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm px-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Failed to load chapter</p>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
          </div>
          <button
            onClick={refetchContent}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!activeChapterContent) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  return (
    <ChapterContentView
      chapter={activeChapterContent}
      completedBlockIds={completedBlockIds}
      isLast={activeIndex === totalCount - 1}
      onMarkBlockComplete={handleMarkBlockComplete}
      onNext={handleNext}
      onPrevious={handlePrevious}
      hasPrevious={activeIndex > 0}
      isLoading={isLoading}
      examAvailable={examAvailable}
      onStartExam={onStartExam}
    />
  );
}
