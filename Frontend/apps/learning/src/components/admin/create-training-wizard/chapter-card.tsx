"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Pencil, Trash2, GripVertical, Layers } from "lucide-react";
import type { WizardChapter } from "@/types/admin";

const LAYOUT_LABELS: Record<string, string> = {
  SingleContent: "Single Content",
  SplitLayout: "Split Layout",
  MultiSection: "Multi Section",
};

interface ChapterCardProps {
  chapter: WizardChapter;
  index: number;
  onEdit: () => void;
  onRemove: () => void;
}

export function ChapterCard({ chapter, index, onEdit, onRemove }: ChapterCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: chapter.clientId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group flex items-center gap-3 rounded-2xl border border-border bg-background p-4 shadow-sm transition-all hover:shadow-md">
      <button
        type="button"
        className="flex h-8 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground/40 hover:text-muted-foreground"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-bold text-muted-foreground">
        {index + 1}
      </div>

      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
        <Layers className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{chapter.title}</p>
        <p className="text-[12px] text-muted-foreground">
          {LAYOUT_LABELS[chapter.layout] ?? chapter.layout}
        </p>
      </div>

      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button onClick={onEdit} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Pencil className="h-4 w-4" />
        </button>
        <button onClick={onRemove} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
