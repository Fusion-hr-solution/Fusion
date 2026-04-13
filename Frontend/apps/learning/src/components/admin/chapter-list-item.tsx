"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Clock } from "lucide-react";
import { Button } from "@repo/ui";
import { CONTENT_TYPES } from "@/data/chapter-templates";

interface ChapterListItemProps {
  /** Unique identifier used by dnd-kit (chapter.id or chapter.clientId) */
  id: string;
  title: string;
  contentType: string;
  estimatedDurationMinutes?: number;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  /** When true, action buttons are disabled (soft-deleted item) */
  isDeleted?: boolean;
  /** Visual variant — compact for the admin detail view, card for the wizard */
  variant?: "card" | "compact";
}

export function ChapterListItem({
  id,
  title,
  contentType,
  estimatedDurationMinutes,
  index,
  onEdit,
  onDelete,
  isDeleted = false,
  variant = "compact",
}: ChapterListItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const typeConfig = CONTENT_TYPES.find((t) => t.type === contentType);
  const Icon = typeConfig?.icon ?? CONTENT_TYPES[0]!.icon;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (variant === "card") {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="group flex items-center gap-3 rounded-2xl border border-border bg-background p-4 shadow-sm transition-all hover:shadow-md"
      >
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground/40 hover:text-muted-foreground"
          {...attributes}
          {...listeners}
          disabled={isDeleted}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-bold text-muted-foreground">
          {index + 1}
        </div>

        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${typeConfig?.colorClass ?? "bg-muted"}`}>
          <Icon className={`h-5 w-5 ${typeConfig?.iconColorClass ?? "text-muted-foreground"}`} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          <p className="text-[12px] text-muted-foreground">
            {typeConfig?.label ?? contentType}
            {estimatedDurationMinutes ? ` · ${estimatedDurationMinutes} min` : ""}
          </p>
        </div>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={onEdit}
            disabled={isDeleted}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleted}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // compact variant (admin detail view)
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
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${typeConfig?.colorClass ?? "bg-muted"}`}>
        <Icon className={`h-4 w-4 ${typeConfig?.iconColorClass ?? "text-muted-foreground"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{typeConfig?.label ?? contentType}</span>
          {estimatedDurationMinutes && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {estimatedDurationMinutes} min
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onEdit} disabled={isDeleted} aria-label={`Edit ${title}`}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={isDeleted}
          aria-label={`Delete ${title}`}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
