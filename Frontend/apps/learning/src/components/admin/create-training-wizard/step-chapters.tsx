"use client";

import { useState, useCallback } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Layers, Plus, ArrowLeft, ArrowRight, AlertTriangle } from "lucide-react";
import type { WizardState } from "@/types/admin-props";
import type { WizardChapter } from "@/types/admin";
import { ChapterCard } from "./chapter-card";
import { ChapterEditorDialog } from "./chapter-editor-dialog";

interface StepChaptersProps {
  wizard: WizardState;
}

export function StepChapters({ wizard }: StepChaptersProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<WizardChapter | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = wizard.chapters.findIndex((c) => c.clientId === active.id);
      const newIndex = wizard.chapters.findIndex((c) => c.clientId === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      wizard.reorderChapters(arrayMove(wizard.chapters, oldIndex, newIndex));
    },
    [wizard],
  );

  function handleAdd(chapter: Omit<WizardChapter, "clientId">) {
    wizard.addChapter(chapter);
    setEditorOpen(false);
  }

  function handleEdit(chapter: WizardChapter) {
    setEditingChapter(chapter);
    setEditorOpen(true);
  }

  function handleSaveEdit(updates: Omit<WizardChapter, "clientId">) {
    if (editingChapter) wizard.updateChapter(editingChapter.clientId, updates);
    setEditingChapter(null);
    setEditorOpen(false);
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground">
              <Layers className="h-3.5 w-3.5 text-background" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Chapters</h2>
          </div>
          <p className="ml-9 text-[13px] text-muted-foreground">
            Add chapters to build your training content
          </p>
        </div>
        <button
          onClick={() => { setEditingChapter(null); setEditorOpen(true); }}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm transition-all ey-bg-dark text-white hover:opacity-90 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" /> Add Chapter
        </button>
      </div>

      {wizard.formError && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{wizard.formError}</span>
        </div>
      )}

      {/* Chapter list */}
      {wizard.chapters.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/20 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Layers className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-semibold text-foreground">No chapters yet</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Click &ldquo;Add Chapter&rdquo; to start building your training content
          </p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={wizard.chapters.map((c) => c.clientId)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {wizard.chapters.map((ch, index) => (
                <ChapterCard
                  key={ch.clientId}
                  chapter={ch}
                  index={index}
                  onEdit={() => handleEdit(ch)}
                  onRemove={() => wizard.removeChapter(ch.clientId)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Footer */}
      <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
        <button
          onClick={wizard.prevStep}
          className="flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={wizard.handleNext}
          disabled={wizard.chapters.length === 0}
          className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold shadow-sm transition-all ${
            wizard.chapters.length > 0
              ? "ey-bg-dark text-white hover:opacity-90 active:scale-[0.98]"
              : "cursor-not-allowed bg-muted text-muted-foreground"
          }`}
        >
          Continue to Review <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <ChapterEditorDialog
        open={editorOpen}
        onOpenChange={(o) => { setEditorOpen(o); if (!o) setEditingChapter(null); }}
        editingChapter={editingChapter}
        onAdd={handleAdd}
        onSaveEdit={handleSaveEdit}
      />
    </div>
  );
}
