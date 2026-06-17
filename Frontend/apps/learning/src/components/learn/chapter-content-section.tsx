import { Loader2, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { useCoursePlayer } from "@/hooks/use-course-player";
import { ChapterContentView } from "./chapter-content-view";

export function ChapterContent({
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
  const t = useTranslations("learn");
  const tCommon = useTranslations("common");

  if (isLoadingContent) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (contentError) {
    const errorMsg = contentError instanceof Error ? contentError.message : t("chapter.loadErrorGeneric");
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm px-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">{t("chapter.loadErrorTitle")}</p>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
          </div>
          <button onClick={refetchContent} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity">{tCommon("actions.retry")}</button>
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
