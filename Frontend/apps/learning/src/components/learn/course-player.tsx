"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { CoursePlayerProps } from "@/types/component-props";
import { useCoursePlayer } from "@/hooks/use-course-player";
import { useExamPlayer } from "@/hooks/use-exam-player";
import { ChapterSidebar } from "./chapter-sidebar";
import { ExamLockedBanner } from "./exam-locked-banner";
import { ExamPlayerContent } from "./exam-player-content";
import { ChapterContent } from "./chapter-content-section";
import { usePublishAssistantScope } from "@/components/assistant/assistant-scope";

export function CoursePlayer({ learnData }: CoursePlayerProps) {
  const t = useTranslations("learn.player");
  const [showExam, setShowExam] = useState(false);

  const {
    activeChapterContent, activeChapterId, activeIndex, chapters, completedBlockIds,
    completedCount, totalCount, overallProgress, allChaptersCompleted,
    isLoading, isLoadingContent, contentError, setActiveChapterId,
    handleMarkBlockComplete, handleNext, handlePrevious, refetchContent,
  } = useCoursePlayer(learnData);

  // Scope the module-wide Academy Assistant to the chapter being read (AI-L-1).
  usePublishAssistantScope(
    !showExam && activeChapterId
      ? { trainingId: learnData.training.id, chapterId: activeChapterId }
      : null,
  );

  // ?chapter=<id> deep link (assistant citation chips, AI-L-1 A4). The mount-time
  // initializer covers fresh mounts; this effect covers query-only soft navigations to
  // the already-mounted player. Consume the param afterwards so a reload/bookmark falls
  // back to the normal first-incomplete resume logic.
  const chapterParam = useSearchParams().get("chapter");
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (!chapterParam) return;
    if (chapters.some((c) => c.id === chapterParam)) {
      setShowExam(false);
      setActiveChapterId(chapterParam);
    }
    router.replace(pathname, { scroll: false });
  }, [chapterParam, chapters, pathname, router, setActiveChapterId]);

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
