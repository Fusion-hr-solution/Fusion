"use client";

import type { SortableChapterItemProps } from "@/types/admin-props";
import { ChapterListItem } from "./chapter-list-item";

export function SortableChapterItem({ chapter, index, isDeleted, onEdit, onDelete }: SortableChapterItemProps) {
  const primaryBlock = chapter.contentBlocks[0];

  return (
    <ChapterListItem
      id={chapter.id}
      title={chapter.title}
      contentType={primaryBlock?.type ?? "Article"}
      estimatedDurationMinutes={primaryBlock?.estimatedDurationMinutes}
      index={index}
      onEdit={onEdit}
      onDelete={onDelete}
      isDeleted={isDeleted}
      variant="compact"
    />
  );
}
