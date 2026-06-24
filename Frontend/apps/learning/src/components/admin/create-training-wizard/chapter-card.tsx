"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Pencil, Trash2, GripVertical, Layers, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { WizardChapter } from "@/types/admin";

const LAYOUT_LABELS: Record<string, string> = {
  SingleContent: "Single Content",
  SplitLayout: "Split Layout",
  MultiSection: "Multi Section",
};

interface ChapterCardProps {
  chapter: WizardChapter;
  index: number;
  /** Present in edit mode — clientId equals the real server chapter ID. */
  trainingId?: string;
  onEdit: () => void;
  onRemove: () => void;
}

export function ChapterCard({ chapter, index, trainingId, onEdit, onRemove }: ChapterCardProps) {
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
        className="flex h-8 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground/40 hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
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

      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {trainingId && (
          <Link
            href={`/admin/trainings/${trainingId}/chapters/${chapter.clientId}`}
            className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            Open Builder
          </Link>
        )}
        <button
          onClick={onEdit}
          aria-label={`Edit ${chapter.title}`}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          onClick={onRemove}
          aria-label={`Remove ${chapter.title}`}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
