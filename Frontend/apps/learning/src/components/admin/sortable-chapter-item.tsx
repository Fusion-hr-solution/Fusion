"use client";

import { useState, useCallback } from "react";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, DragOverlay } from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Layers, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@repo/ui";
import { useApiMutation } from "@repo/api/react";
import { addContentBlock, reorderContentBlocks } from "@/services/admin-service";
import type { SortableChapterItemProps } from "@/types/admin-props";
import { ContentBlockList } from "./content-block-list";
import { ContentTypePalette } from "./content-type-palette";
import { CONTENT_TYPES } from "@/data/chapter-templates";

const LAYOUT_LABELS: Record<string, string> = {
  SingleContent: "Single",
  SplitLayout: "Split",
  MultiSection: "Multi",
};

export function SortableChapterItem({ trainingId, chapter, index, isDeleted, onEdit, onDelete, onRefetch }: SortableChapterItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeType, setActiveType] = useState<string | null>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: chapter.id });

  const innerSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { mutateAsync: doAdd } = useApiMutation(
    (input: { type: string; orderIndex: number }) =>
      addContentBlock(trainingId, chapter.id, { ...input }),
    { onSuccess: onRefetch },
  );

  const { mutateAsync: doReorder } = useApiMutation(
    (ids: string[]) => reorderContentBlocks(trainingId, chapter.id, ids),
    { onSuccess: onRefetch },
  );

  const handleInnerDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.source === "palette") {
      setActiveType(data.contentType as string);
    }
  }, []);

  const handleInnerDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveType(null);
      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current;

      // Palette item dropped into the zone
      if (activeData?.source === "palette") {
        const contentType = activeData.contentType as string;
        const nextIndex = chapter.contentBlocks.length;
        await doAdd({ type: contentType, orderIndex: nextIndex });
        return;
      }

      // Block reordering within the chapter
      if (activeData?.source === "block" && active.id !== over.id) {
        const sorted = [...chapter.contentBlocks].sort((a, b) => a.orderIndex - b.orderIndex);
        const oldIdx = sorted.findIndex((b) => b.id === active.id);
        const newIdx = sorted.findIndex((b) => b.id === over.id);
        if (oldIdx !== -1 && newIdx !== -1) {
          const reordered = arrayMove(sorted, oldIdx, newIdx);
          await doReorder(reordered.map((b) => b.id));
        }
      }
    },
    [chapter.contentBlocks, doAdd, doReorder],
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const typeConfig = activeType ? CONTENT_TYPES.find((t) => t.type === activeType) : null;

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

      {/* Expandable: palette + droppable block list */}
      {expanded && (
        <div className="border-t border-border/30 px-3 pb-4 pt-3">
          <DndContext
            sensors={innerSensors}
            collisionDetection={closestCenter}
            onDragStart={handleInnerDragStart}
            onDragEnd={handleInnerDragEnd}
          >
            <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
              {/* Palette */}
              <div className="order-2 lg:order-1">
                <ContentTypePalette />
              </div>

              {/* Drop zone + existing blocks */}
              <div className="order-1 lg:order-2">
                <ContentBlockList
                  trainingId={trainingId}
                  chapterId={chapter.id}
                  blocks={chapter.contentBlocks}
                  isDeleted={isDeleted}
                  onRefetch={onRefetch}
                  isDropTarget
                />
              </div>
            </div>

            {/* Drag overlay for palette items */}
            <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
              {typeConfig && (
                <div className="flex items-center gap-2.5 rounded-xl border-2 border-foreground/20 bg-background px-3 py-2.5 shadow-lg">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${typeConfig.colorClass}`}>
                    <typeConfig.icon className={`h-4 w-4 ${typeConfig.iconColorClass}`} />
                  </div>
                  <p className="text-xs font-semibold text-foreground">{typeConfig.label}</p>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      )}
    </div>
  );
}
