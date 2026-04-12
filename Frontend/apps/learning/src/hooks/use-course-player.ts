"use client";

import { useState, useCallback, useMemo } from "react";
import { useApiMutation } from "@repo/api/react";
import type { TrainingLearnData, ChapterProgressEntry } from "@/types";
import { updateChapterProgress } from "@/services/learning-service";

export function useCoursePlayer(initialData: TrainingLearnData) {
  const [chapterProgress, setChapterProgress] = useState<ChapterProgressEntry[]>(
    initialData.chapterProgress,
  );
  const [activeChapterId, setActiveChapterId] = useState<string>(
    () => getInitialChapter(initialData),
  );
  const [pendingChapterId, setPendingChapterId] = useState<string | null>(null);

  const { mutate: markComplete, isLoading } = useApiMutation<void, string>(
    (chapterId: string) =>
      updateChapterProgress(initialData.training.id, chapterId, true),
    {
      onSuccess: () => {
        if (pendingChapterId) {
          setChapterProgress((prev) =>
            prev.map((p) =>
              p.chapterId === pendingChapterId
                ? { ...p, completed: true, completedAt: new Date().toISOString() }
                : p,
            ),
          );
          setPendingChapterId(null);
        }
      },
    },
  );

  const completedSet = useMemo(
    () => new Set(chapterProgress.filter((p) => p.completed).map((p) => p.chapterId)),
    [chapterProgress],
  );

  const completedCount = completedSet.size;
  const totalCount = initialData.chapters.length;
  const overallProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const allChaptersCompleted = completedCount === totalCount;

  const activeIndex = useMemo(
    () => initialData.chapters.findIndex((c) => c.id === activeChapterId),
    [initialData.chapters, activeChapterId],
  );

  const activeChapter = initialData.chapters[activeIndex] ?? initialData.chapters[0] ?? null;

  const handleMarkComplete = useCallback(() => {
    if (activeChapter && !completedSet.has(activeChapter.id)) {
      setPendingChapterId(activeChapter.id);
      markComplete(activeChapter.id);
    }
  }, [activeChapter, completedSet, markComplete]);

  const handleNext = useCallback(() => {
    if (activeIndex < totalCount - 1) {
      setActiveChapterId(initialData.chapters[activeIndex + 1]!.id);
    }
  }, [activeIndex, totalCount, initialData.chapters]);

  const handlePrevious = useCallback(() => {
    if (activeIndex > 0) {
      setActiveChapterId(initialData.chapters[activeIndex - 1]!.id);
    }
  }, [activeIndex, initialData.chapters]);

  return {
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
  };
}

function getInitialChapter(data: TrainingLearnData): string {
  const completedIds = new Set(
    data.chapterProgress.filter((p) => p.completed).map((p) => p.chapterId),
  );
  const firstIncomplete = data.chapters.find((c) => !completedIds.has(c.id));
  return firstIncomplete?.id ?? data.chapters[0]?.id ?? "";
}
