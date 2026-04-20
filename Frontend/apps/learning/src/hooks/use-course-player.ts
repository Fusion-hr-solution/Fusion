"use client";

import { useState, useCallback, useMemo } from "react";
import { useApiMutation, useApiQuery } from "@repo/api/react";
import type { TrainingLearnData, ChapterListItem } from "@/types";
import { updateContentBlockProgress, getChapterContent } from "@/services/learning-service";

export function useCoursePlayer(initialData: TrainingLearnData) {
  const [chapters, setChapters] = useState<ChapterListItem[]>(initialData.chapters);
  const [activeChapterId, setActiveChapterId] = useState<string>(
    () => getInitialChapter(initialData),
  );

  const trainingId = initialData.training.id;

  const fetchChapterContent = useCallback(
    () => getChapterContent(trainingId, activeChapterId),
    [trainingId, activeChapterId],
  );

  // Load chapter content on demand
  const { data: activeChapterContent, isLoading: isLoadingContent, error: contentError, refetch: refetchContent } = useApiQuery(
    fetchChapterContent,
    { enabled: Boolean(activeChapterId) },
  );

  const { mutate: markBlockComplete, isLoading: isMarkingComplete } = useApiMutation<void, { chapterId: string; blockId: string }>(
    ({ chapterId, blockId }) =>
      updateContentBlockProgress(trainingId, chapterId, blockId, true),
    {
      onSuccess: () => {
        refetchContent();
        // Optimistically update chapter list progress
        setChapters((prev) =>
          prev.map((ch) =>
            ch.id === activeChapterId
              ? { ...ch, completedBlockCount: ch.completedBlockCount + 1, isCompleted: ch.completedBlockCount + 1 >= ch.blockCount }
              : ch,
          ),
        );
      },
    },
  );

  const completedSet = useMemo(
    () => new Set(chapters.filter((ch) => ch.isCompleted).map((ch) => ch.id)),
    [chapters],
  );

  const completedBlockIds = useMemo(() => {
    if (!activeChapterContent) return new Set<string>();
    return new Set(activeChapterContent.contentBlocks.filter((b) => b.isCompleted).map((b) => b.id));
  }, [activeChapterContent]);

  const completedCount = completedSet.size;
  const totalCount = chapters.length;
  const overallProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const allChaptersCompleted = completedCount === totalCount;

  const activeIndex = useMemo(
    () => chapters.findIndex((c) => c.id === activeChapterId),
    [chapters, activeChapterId],
  );

  const handleMarkBlockComplete = useCallback((blockId: string) => {
    if (completedBlockIds.has(blockId)) return;
    markBlockComplete({ chapterId: activeChapterId, blockId });
  }, [activeChapterId, completedBlockIds, markBlockComplete]);

  const handleNext = useCallback(() => {
    if (activeIndex < totalCount - 1) {
      setActiveChapterId(chapters[activeIndex + 1]!.id);
    }
  }, [activeIndex, totalCount, chapters]);

  const handlePrevious = useCallback(() => {
    if (activeIndex > 0) {
      setActiveChapterId(chapters[activeIndex - 1]!.id);
    }
  }, [activeIndex, chapters]);

  return {
    activeChapterContent,
    activeChapterId,
    activeIndex,
    chapters,
    completedSet,
    completedBlockIds,
    completedCount,
    totalCount,
    overallProgress,
    allChaptersCompleted,
    isLoading: isMarkingComplete,
    isLoadingContent,
    contentError,
    setActiveChapterId,
    handleMarkBlockComplete,
    handleNext,
    handlePrevious,
    refetchContent,
  };
}

function getInitialChapter(data: TrainingLearnData): string {
  const firstIncomplete = data.chapters.find((c) => !c.isCompleted);
  return firstIncomplete?.id ?? data.chapters[0]?.id ?? "";
}
