"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Pencil,
  Trash2,
  Copy,
  ExternalLink,
  Layers,
} from "lucide-react";
import { Button } from "@repo/ui";
import type { AdminChapter } from "@/types/admin";
import type { ChapterManagerListProps } from "@/types/admin-props";
import { CONTENT_TYPES } from "@/data/chapter-templates";

const LAYOUT_LABELS: Record<string, string> = {
  SingleContent: "Single Content",
  SplitLayout: "Split Layout",
  MultiSection: "Multi-Section",
};

/* ── Chapter row ── */

interface ChapterRowProps {
  chapter: AdminChapter;
  index: number;
  isDeleted: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onOpen: () => void;
}

function ChapterRow({
  chapter,
  index,
  isDeleted,
  onEdit,
  onDelete,
  onDuplicate,
  onOpen,
}: ChapterRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chapter.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const blockCount = chapter.contentBlocks.length;
  const blockTypes = [...new Set(chapter.contentBlocks.map((b) => b.type))];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-4 rounded-xl border bg-background px-5 py-4 transition-all ${
        isDragging
          ? "border-foreground/20 shadow-xl ring-2 ring-foreground/5 scale-[1.01]"
          : "border-border/50 hover:border-border hover:shadow-sm"
      }`}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground/30 transition-colors hover:text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
        disabled={isDeleted}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* Index */}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold text-muted-foreground">
        {index + 1}
      </span>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {chapter.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {LAYOUT_LABELS[chapter.layout] ?? chapter.layout}
          </span>
          <span>
            {blockCount} block{blockCount !== 1 ? "s" : ""}
          </span>
          {blockTypes.length > 0 && (
            <span className="flex items-center gap-1.5">
              {blockTypes.map((type) => {
                const cfg = CONTENT_TYPES.find((c) => c.type === type);
                if (!cfg) return null;
                return (
                  <span
                    key={type}
                    className={`flex h-5 w-5 items-center justify-center rounded ${cfg.colorClass}`}
                    title={cfg.label}
                  >
                    <cfg.icon className={`h-3 w-3 ${cfg.iconColorClass}`} />
                  </span>
                );
              })}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpen}
          disabled={isDeleted}
          className="h-8 gap-1.5 text-xs"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open Builder
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          disabled={isDeleted}
          aria-label="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDuplicate}
          disabled={isDeleted}
          aria-label="Duplicate"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={isDeleted}
          aria-label="Delete"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ── Overlay while dragging ── */

function DragPreview({ chapter, index }: { chapter: AdminChapter; index: number }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-foreground/20 bg-background px-5 py-4 shadow-2xl ring-2 ring-foreground/5">
      <GripVertical className="h-5 w-5 text-muted-foreground/30" />
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold text-muted-foreground">
        {index + 1}
      </span>
      <p className="truncate text-sm font-semibold text-foreground">{chapter.title}</p>
    </div>
  );
}

/* ── Main list ── */

export function ChapterManagerList({
  chapters,
  isDeleted,
  onReorder,
  onEdit,
  onDelete,
  onDuplicate,
  onOpen,
}: ChapterManagerListProps) {
  const [ordered, setOrdered] = useState<AdminChapter[]>(chapters);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setOrdered(chapters);
  }, [chapters]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIdx = ordered.findIndex((c) => c.id === active.id);
      const newIdx = ordered.findIndex((c) => c.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;

      const reordered = arrayMove(ordered, oldIdx, newIdx);
      setOrdered(reordered);

      try {
        await onReorder(reordered.map((c) => c.id));
      } catch {
        setOrdered(ordered);
      }
    },
    [ordered, onReorder],
  );

  const activeChapter = activeId ? ordered.find((c) => c.id === activeId) : null;
  const activeIndex = activeId ? ordered.findIndex((c) => c.id === activeId) : -1;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={ordered.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {ordered.map((ch, i) => (
            <ChapterRow
              key={ch.id}
              chapter={ch}
              index={i}
              isDeleted={isDeleted}
              onEdit={() => onEdit(ch)}
              onDelete={() => onDelete(ch)}
              onDuplicate={() => onDuplicate(ch)}
              onOpen={() => onOpen(ch)}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
        {activeChapter && <DragPreview chapter={activeChapter} index={activeIndex} />}
      </DragOverlay>
    </DndContext>
  );
}
