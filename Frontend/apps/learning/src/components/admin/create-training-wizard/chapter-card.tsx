"use client";

import type { WizardChapter } from "@/types/admin";
import { ChapterListItem } from "../chapter-list-item";

interface ChapterCardProps {
  chapter: WizardChapter;
  index: number;
  onEdit: () => void;
  onRemove: () => void;
}

export function ChapterCard({ chapter, index, onEdit, onRemove }: ChapterCardProps) {
  return (
    <ChapterListItem
      id={chapter.clientId}
      title={chapter.title}
      contentType={chapter.contentType}
      estimatedDurationMinutes={chapter.estimatedDurationMinutes}
      index={index}
      onEdit={onEdit}
      onDelete={onRemove}
      variant="card"
    />
  );
}
