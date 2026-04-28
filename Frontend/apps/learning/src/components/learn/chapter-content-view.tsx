"use client";

import { BookOpen } from "lucide-react";
import type { ChapterContentViewProps } from "@/types/component-props";
import type { ContentBlock, ChapterLayout } from "@/types";
import { ChapterNavigation } from "./chapter-navigation";
import { ContentBlockView } from "./content-block-view";

export function ChapterContentView({
  chapter,
  completedBlockIds,
  isLast,
  onMarkBlockComplete,
  onNext,
  onPrevious,
  hasPrevious,
  isLoading,
  examAvailable,
  onStartExam,
}: ChapterContentViewProps) {
  const sortedBlocks = [...chapter.contentBlocks].sort((a, b) => a.orderIndex - b.orderIndex);
  const allBlocksCompleted = sortedBlocks.length > 0 && sortedBlocks.every((b) => completedBlockIds.has(b.id));

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <div className="ey-animate-fade-up mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">{chapter.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {sortedBlocks.length} {sortedBlocks.length === 1 ? "block" : "blocks"} · {completedBlockIds.size}/{sortedBlocks.length} completed
        </p>
      </div>

      {renderBlocksWithLayout(sortedBlocks, chapter.layout, completedBlockIds, onMarkBlockComplete, isLoading)}

      <ChapterNavigation
        allBlocksCompleted={allBlocksCompleted}
        isLast={isLast}
        onNext={onNext}
        onPrevious={onPrevious}
        hasPrevious={hasPrevious}
        isLoading={isLoading}
        examAvailable={examAvailable}
        onStartExam={onStartExam}
      />
    </div>
  );
}

function renderBlocksWithLayout(
  blocks: ContentBlock[],
  layout: ChapterLayout,
  completedBlockIds: Set<string>,
  onMarkBlockComplete: (blockId: string) => void,
  isLoading: boolean,
) {
  if (blocks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 px-8 py-16 text-center">
        <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Content for this chapter is not yet available.</p>
      </div>
    );
  }

  const blockElements = (list: ContentBlock[], startIndex: number) =>
    list.map((block, i) => (
      <ContentBlockView key={block.id} block={block} index={startIndex + i} isCompleted={completedBlockIds.has(block.id)} onMarkComplete={() => onMarkBlockComplete(block.id)} isLoading={isLoading} />
    ));

  if (layout === "SplitLayout" && blocks.length >= 2) {
    const mid = Math.ceil(blocks.length / 2);
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">{blockElements(blocks.slice(0, mid), 0)}</div>
        <div className="space-y-6">{blockElements(blocks.slice(mid), mid)}</div>
      </div>
    );
  }

  if (layout === "MultiSection") {
    return (
      <div className="space-y-10">
        {blocks.map((block, i) => (
          <div key={block.id}>
            {i > 0 && <hr className="mb-6 border-border/40" />}
            <ContentBlockView block={block} index={i} isCompleted={completedBlockIds.has(block.id)} onMarkComplete={() => onMarkBlockComplete(block.id)} isLoading={isLoading} />
          </div>
        ))}
      </div>
    );
  }

  return <div className="space-y-8">{blockElements(blocks, 0)}</div>;
}
