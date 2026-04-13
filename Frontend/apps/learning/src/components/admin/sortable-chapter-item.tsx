"use client";

import type { SortableChapterItemProps } from "@/types/admin-props";
import { ChapterListItem } from "./chapter-list-item";

export function SortableChapterItem({ chapter, index, isDeleted, onEdit, onDelete }: SortableChapterItemProps) {
  return (
    <ChapterListItem
      id={chapter.id}
      title={chapter.title}
      contentType={chapter.contentType}
      estimatedDurationMinutes={chapter.estimatedDurationMinutes}
      index={index}
      onEdit={onEdit}
      onDelete={onDelete}
      isDeleted={isDeleted}
      variant="compact"
    />
  );
}
