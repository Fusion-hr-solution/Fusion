"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent, DragOverEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Check, Loader2, Eye } from "lucide-react";
import { Input, Button } from "@repo/ui";
import { useChapterBuilder } from "@/hooks/use-chapter-builder";
import { CONTENT_TYPES } from "@/data/chapter-templates";
import { PageBreadcrumb } from "../page-breadcrumb";
import { BuilderSidebar } from "./builder-sidebar";
import { BuilderCanvas } from "./builder-canvas";
import { ChapterPreview } from "./chapter-preview";
import { ContentBlockEditorDialog } from "./content-block-editor-dialog";

export function ChapterBuilder({
  trainingId,
  chapterId,
}: {
  trainingId: string;
  chapterId: string;
}) {
  const builder = useChapterBuilder(trainingId, chapterId);
  const {
    training,
    chapter,
    blocks,
    isLoading,
    refetch,
    editingBlock,
    editorOpen,
    openEditor,
    closeEditor,
    handleAddBlock,
    handleDeleteBlock,
    handleReorderBlocks,
    handleUpdateTitle,
    handleUpdateLayout,
  } = builder;

  const [activeType, setActiveType] = useState<string | null>(null);
  const [isOverCanvas, setIsOverCanvas] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [titleSaved, setTitleSaved] = useState(false);
  const titleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync title from server
  useEffect(() => {
    if (chapter) setTitleValue(chapter.title);
  }, [chapter]);

  // Debounced title save
  const handleTitleChange = useCallback(
    (value: string) => {
      setTitleValue(value);
      setTitleSaved(false);
      if (titleTimeout.current) clearTimeout(titleTimeout.current);
      titleTimeout.current = setTimeout(async () => {
        if (value.trim()) {
          setIsSavingTitle(true);
          await handleUpdateTitle(value.trim());
          setIsSavingTitle(false);
          setTitleSaved(true);
          setTimeout(() => setTitleSaved(false), 2000);
        }
      }, 800);
    },
    [handleUpdateTitle],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.source === "palette") {
      setActiveType(data.contentType as string);
    }
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id;
    setIsOverCanvas(
      overId === "builder-canvas" ||
        (event.over?.data.current?.source === "block") ||
        false,
    );
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveType(null);
      setIsOverCanvas(false);
      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current;

      // Palette → canvas drop
      if (activeData?.source === "palette") {
        const contentType = activeData.contentType as string;
        await handleAddBlock(contentType);
        return;
      }

      // Block reorder
      if (activeData?.source === "block" && active.id !== over.id) {
        const oldIdx = blocks.findIndex((b) => b.id === active.id);
        const overIdx = blocks.findIndex((b) => b.id === over.id);
        if (oldIdx !== -1 && overIdx !== -1) {
          const reordered = arrayMove(blocks, oldIdx, overIdx);
          await handleReorderBlocks(reordered.map((b) => b.id));
        }
      }
    },
    [blocks, handleAddBlock, handleReorderBlocks],
  );

  const typeConfig = activeType
    ? CONTENT_TYPES.find((t) => t.type === activeType)
    : null;

  if (isLoading || !training || !chapter) {
    return (
      <div className="flex items-center justify-center py-32 text-sm text-muted-foreground">
        Loading chapter...
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 border-b border-border bg-background">
        <PageBreadcrumb
          backHref={`/admin/trainings/${trainingId}`}
          backLabel="Chapters"
          items={[
            { label: "Trainings", href: "/admin/trainings" },
            { label: training.title, href: `/admin/trainings/${trainingId}` },
            { label: chapter.title },
          ]}
        />

        {/* Inline title editor + preview toggle */}
        <div className="flex items-center gap-3 px-8 pb-4">
          <Input
            value={titleValue}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="h-10 max-w-md border-none bg-transparent text-lg font-bold text-foreground shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-1"
            placeholder="Chapter title..."
          />
          {isSavingTitle && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {titleSaved && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
          <div className="ml-auto">
            <Button
              variant={showPreview ? "default" : "outline"}
              size="sm"
              onClick={() => setShowPreview((v) => !v)}
              className="gap-1.5"
            >
              <Eye className="h-4 w-4" />
              {showPreview ? "Back to Editor" : "Preview"}
            </Button>
          </div>
        </div>
      </div>

      {/* Preview mode */}
      {showPreview ? (
        <div className="flex-1 overflow-hidden">
          <ChapterPreview
            title={titleValue || chapter.title}
            layout={chapter.layout}
            blocks={blocks}
            onClose={() => setShowPreview(false)}
          />
        </div>
      ) : (
      /* Builder body: sidebar + canvas */
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 overflow-hidden">
          <BuilderSidebar
            layout={chapter.layout}
            onLayoutChange={handleUpdateLayout}
          />

          <main className="flex-1 overflow-y-auto bg-muted/20 p-8">
            <div className="mx-auto max-w-3xl">
              <BuilderCanvas
                blocks={blocks}
                layout={chapter.layout}
                isOver={isOverCanvas}
                onEditBlock={(b) => openEditor(b)}
                onDeleteBlock={handleDeleteBlock}
              />
            </div>
          </main>
        </div>

        {/* Drag overlay for palette items */}
        <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
          {typeConfig && (
            <div className="flex items-center gap-3 rounded-xl border-2 border-foreground/20 bg-background px-4 py-3 shadow-2xl">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${typeConfig.colorClass}`}
              >
                <typeConfig.icon
                  className={`h-4 w-4 ${typeConfig.iconColorClass}`}
                />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {typeConfig.label}
              </p>
            </div>
          )}
        </DragOverlay>
      </DndContext>
      )}

      {/* Block editor dialog */}
      <ContentBlockEditorDialog
        trainingId={trainingId}
        chapterId={chapterId}
        block={editingBlock}
        open={editorOpen}
        onOpenChange={(o) => {
          if (!o) closeEditor();
        }}
        onSaved={refetch}
      />
    </div>
  );
}
