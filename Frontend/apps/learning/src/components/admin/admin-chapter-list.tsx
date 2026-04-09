"use client";

import { useState, useEffect, useCallback } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import type { AdminChapter } from "@/types/admin";
import type { AdminChapterListProps } from "@/types/admin-props";
import { SortableChapterItem } from "./sortable-chapter-item";

export function AdminChapterList({
  trainingId,
  chapters,
  isDeleted,
  onAddChapter,
  onEditChapter,
  onDeleteChapter,
  onReorder,
  onRefetch,
}: AdminChapterListProps) {
  const [orderedChapters, setOrderedChapters] = useState<AdminChapter[]>(() =>
    [...chapters].sort((a, b) => a.orderIndex - b.orderIndex),
  );

  // Sync from props when parent refetches
  useEffect(() => {
    setOrderedChapters([...chapters].sort((a, b) => a.orderIndex - b.orderIndex));
  }, [chapters]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = orderedChapters.findIndex((c) => c.id === active.id);
      const newIndex = orderedChapters.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(orderedChapters, oldIndex, newIndex);

      // Optimistic update
      setOrderedChapters(reordered);

      try {
        await onReorder(reordered.map((c) => c.id));
      } catch {
        // Revert to previous order on failure
        setOrderedChapters(orderedChapters);
      }
    },
    [orderedChapters, onReorder],
  );

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Chapters</CardTitle>
        <Button size="sm" onClick={onAddChapter} disabled={isDeleted} className="ey-bg-dark hover:opacity-90">
          <Plus className="mr-1 h-4 w-4" /> Add Chapter
        </Button>
      </CardHeader>
      <CardContent>
        {orderedChapters.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No chapters yet. Add one to get started.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedChapters.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {orderedChapters.map((ch, i) => (
                  <SortableChapterItem
                    key={ch.id}
                    trainingId={trainingId}
                    chapter={ch}
                    index={i}
                    isDeleted={isDeleted}
                    onEdit={() => onEditChapter(ch)}
                    onDelete={() => onDeleteChapter(ch)}
                    onRefetch={onRefetch}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>
    </Card>
  );
}
