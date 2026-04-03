"use client";

import { useCallback } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import type { AdminChapterListProps } from "@/types/admin-props";
import { SortableChapterItem } from "./sortable-chapter-item";

export function AdminChapterList({
  chapters,
  isDeleted,
  onAddChapter,
  onEditChapter,
  onDeleteChapter,
  onReorder,
}: AdminChapterListProps) {
  const sorted = [...chapters].sort((a, b) => a.orderIndex - b.orderIndex);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sorted.findIndex((c) => c.id === active.id);
      const newIndex = sorted.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = [...sorted];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved!);

      onReorder(reordered.map((c) => c.id));
    },
    [sorted, onReorder],
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
        {sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No chapters yet. Add one to get started.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sorted.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {sorted.map((ch, i) => (
                  <SortableChapterItem
                    key={ch.id}
                    chapter={ch}
                    index={i}
                    isDeleted={isDeleted}
                    onEdit={() => onEditChapter(ch)}
                    onDelete={() => onDeleteChapter(ch)}
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
