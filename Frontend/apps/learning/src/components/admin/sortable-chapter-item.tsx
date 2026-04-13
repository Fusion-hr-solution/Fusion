"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Clock, FileText, Video } from "lucide-react";
import { Button } from "@repo/ui";
import type { SortableChapterItemProps } from "@/types/admin-props";

function contentTypeIcon(type: string) {
  return type === "Video" ? <Video className="h-4 w-4" /> : <FileText className="h-4 w-4" />;
}

export function SortableChapterItem({ chapter, index, isDeleted, onEdit, onDelete }: SortableChapterItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: chapter.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-border/40 bg-background p-3 transition-colors hover:bg-muted/30"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground"
        {...attributes}
        {...listeners}
        disabled={isDeleted}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4 shrink-0" />
      </button>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
        {index + 1}
      </span>
      <div className="flex items-center gap-2 text-muted-foreground">
        {contentTypeIcon(chapter.contentType)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{chapter.title}</p>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="capitalize">{chapter.contentType}</span>
          {chapter.estimatedDurationMinutes && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {chapter.estimatedDurationMinutes} min
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onEdit} disabled={isDeleted} aria-label={`Edit ${chapter.title}`}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={isDeleted}
          aria-label={`Delete ${chapter.title}`}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
