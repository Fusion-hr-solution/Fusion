"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Layers, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@repo/ui";
import type { SortableChapterItemProps } from "@/types/admin-props";
import { ContentBlockList } from "./content-block-list";

const LAYOUT_LABELS: Record<string, string> = {
  SingleContent: "Single",
  SplitLayout: "Split",
  MultiSection: "Multi",
};

export function SortableChapterItem({ trainingId, chapter, index, isDeleted, onEdit, onDelete, onRefetch }: SortableChapterItemProps) {
  const [expanded, setExpanded] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: chapter.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border border-border/40 bg-background transition-colors">
      <div className="flex items-center gap-3 p-3">
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
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{chapter.title}</p>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Layers className="h-3 w-3" />
              {LAYOUT_LABELS[chapter.layout] ?? chapter.layout}
            </span>
            <span>{chapter.contentBlocks.length} block{chapter.contentBlocks.length !== 1 ? "s" : ""}</span>
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

      {/* Expandable content blocks section */}
      {expanded && (
        <div className="border-t border-border/30 px-3 pb-3 pt-2">
          <ContentBlockList
            trainingId={trainingId}
            chapterId={chapter.id}
            blocks={chapter.contentBlocks}
            isDeleted={isDeleted}
            onRefetch={onRefetch}
          />
        </div>
      )}
    </div>
  );
}
