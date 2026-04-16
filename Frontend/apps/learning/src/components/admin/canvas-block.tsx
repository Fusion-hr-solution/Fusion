"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Clock } from "lucide-react";
import { Button } from "@repo/ui";
import type { AdminContentBlock } from "@/types/admin";
import { CONTENT_TYPES } from "@/data/chapter-templates";

interface CanvasBlockProps {
  block: AdminContentBlock;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}

export function CanvasBlock({ block, index, onEdit, onDelete }: CanvasBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: block.id,
    data: { source: "block", block },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const cfg = CONTENT_TYPES.find((t) => t.type === block.type);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-3 rounded-xl border bg-background p-4 transition-all ${
        isDragging
          ? "border-foreground/20 shadow-lg ring-2 ring-foreground/5 opacity-60"
          : "border-border/40 hover:border-border hover:shadow-sm"
      }`}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="mt-0.5 cursor-grab touch-none text-muted-foreground/30 transition-colors hover:text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder block"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Index badge */}
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground">
        {index + 1}
      </span>

      {/* Type icon */}
      {cfg && (
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.colorClass}`}
        >
          <cfg.icon className={`h-4 w-4 ${cfg.iconColorClass}`} />
        </div>
      )}

      {/* Content preview */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">
            {block.title || cfg?.label || block.type}
          </p>
          {block.estimatedDurationMinutes && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {block.estimatedDurationMinutes} min
            </span>
          )}
        </div>

        {/* Text preview */}
        {block.textContent && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {block.textContent}
          </p>
        )}

        {/* Video URL preview */}
        {block.videoUrl && !block.textContent && (
          <p className="mt-1.5 truncate text-xs text-muted-foreground">
            {block.videoUrl}
          </p>
        )}

        {/* File reference */}
        {block.contentUri && !block.videoUrl && !block.textContent && (
          <p className="mt-1.5 truncate text-xs text-muted-foreground">
            {block.contentUri.split("/").pop()}
          </p>
        )}

        {/* Empty state */}
        {!block.textContent && !block.videoUrl && !block.contentUri && (
          <p className="mt-1.5 text-xs italic text-muted-foreground/60">
            No content yet — click edit to add
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          aria-label="Edit block"
          className="h-7 w-7 p-0"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          aria-label="Delete block"
          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
