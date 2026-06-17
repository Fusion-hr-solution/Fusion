"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import type { CoursePlayerProps } from "@/types/component-props";
import { useCoursePlayer } from "@/hooks/use-course-player";
import { useExamPlayer } from "@/hooks/use-exam-player";
import { ChapterSidebar } from "./chapter-sidebar";
import { ExamLockedBanner } from "./exam-locked-banner";
import { ExamPlayerContent } from "./exam-player-content";
import { ChapterContent } from "./chapter-content-section";

export function CoursePlayer({ learnData }: CoursePlayerProps) {
  const t = useTranslations("learn.player");
  const [showExam, setShowExam] = useState(false);

  const {
    activeChapterContent, activeChapterId, activeIndex, chapters, completedBlockIds,
    completedCount, totalCount, overallProgress, allChaptersCompleted,
    isLoading, isLoadingContent, contentError, setActiveChapterId,
    handleMarkBlockComplete, handleNext, handlePrevious, refetchContent,
  } = useCoursePlayer(learnData);

  const hasExam = (learnData.training.exam?.questionsCount ?? 0) > 0;
  const examAvailable = hasExam && allChaptersCompleted;
  const examPlayer = useExamPlayer(learnData.training.id);

  const handleOpenExam = useCallback(() => { setShowExam(true); examPlayer.loadExam(); }, [examPlayer]);
  const handleBackFromExam = useCallback(() => { setShowExam(false); }, []);

  if (chapters.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">{t("noChapters")}</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-background">
      <ChapterSidebar
        chapters={chapters} activeChapterId={showExam ? "" : activeChapterId}
        onSelectChapter={(id) => { setShowExam(false); setActiveChapterId(id); }}
        trainingTitle={learnData.training.title} overallProgress={overallProgress}
        examAvailable={examAvailable} onOpenExam={handleOpenExam} isExamActive={showExam}
      />
      <main className="flex flex-1 flex-col overflow-hidden">
        {hasExam && !showExam && (
          <ExamLockedBanner completedCount={completedCount} totalCount={totalCount} examAvailable={allChaptersCompleted} onStartExam={handleOpenExam} />
        )}
        <div className="flex-1 overflow-y-auto">
          {showExam ? (
            <ExamPlayerContent examPlayer={examPlayer} onBack={handleBackFromExam} />
          ) : (
            <ChapterContent
              activeChapterContent={activeChapterContent} isLoadingContent={isLoadingContent}
              contentError={contentError} refetchContent={refetchContent}
              completedBlockIds={completedBlockIds} activeIndex={activeIndex} totalCount={totalCount}
              handleMarkBlockComplete={handleMarkBlockComplete} handleNext={handleNext}
              handlePrevious={handlePrevious} isLoading={isLoading}
              examAvailable={examAvailable} onStartExam={handleOpenExam}
            />
          )}
        </div>
      </main>
    </div>
  );
}
