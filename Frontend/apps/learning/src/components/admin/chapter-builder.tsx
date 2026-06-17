"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import type {
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Check, Loader2, Eye } from "lucide-react";
import { Input, Button } from "@repo/ui";
import { useChapterBuilder } from "@/hooks/use-chapter-builder";
import { useChapterTitle } from "@/hooks/use-chapter-title";
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
  const t = useTranslations("adminChapters");
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

  const { titleValue, handleTitleChange, isSavingTitle, titleSaved } =
    useChapterTitle(chapter?.title, handleUpdateTitle);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [isOverCanvas, setIsOverCanvas] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.source === "palette") setActiveType(data.contentType as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id;
    setIsOverCanvas(
      overId === "builder-canvas" ||
        event.over?.data.current?.source === "block" ||
        false
    );
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveType(null);
      setIsOverCanvas(false);
      const { active, over } = event;
      if (!over) return;
      const activeData = active.data.current;
      if (activeData?.source === "palette") {
        await handleAddBlock(activeData.contentType as string);
        return;
      }
      if (activeData?.source === "block" && active.id !== over.id) {
        const oldIdx = blocks.findIndex((b) => b.id === active.id);
        const overIdx = blocks.findIndex((b) => b.id === over.id);
        if (oldIdx !== -1 && overIdx !== -1)
          await handleReorderBlocks(
            arrayMove(blocks, oldIdx, overIdx).map((b) => b.id)
          );
      }
    },
    [blocks, handleAddBlock, handleReorderBlocks]
  );

  const typeConfig = activeType
    ? CONTENT_TYPES.find((t) => t.type === activeType)
    : null;

  if (isLoading || !training || !chapter) {
    return (
      <div className="flex items-center justify-center py-32 text-sm text-muted-foreground">
        {t("builder.loading")}
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border bg-background">
        <PageBreadcrumb
          backHref={`/admin/trainings/${trainingId}`}
          backLabel={t("builder.breadcrumbChapters")}
          items={[
            {
              label: t("builder.breadcrumbTrainings"),
              href: "/admin/trainings",
            },
            { label: training.title, href: `/admin/trainings/${trainingId}` },
            { label: chapter.title },
          ]}
        />
        <div className="flex items-center gap-3 px-8 pb-4">
          <Input
            value={titleValue}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="h-10 max-w-md border-none bg-transparent text-lg font-bold text-foreground shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-1"
            placeholder={t("builder.titlePlaceholder")}
          />
          {isSavingTitle && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {titleSaved && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Check className="h-3 w-3" /> {t("builder.saved")}
            </span>
          )}
          <div className="ml-auto">
            <Button
              variant={showPreview ? "default" : "outline"}
              size="sm"
              onClick={() => setShowPreview((v) => !v)}
              className="gap-1.5"
            >
              <Eye className="h-4 w-4" />{" "}
              {showPreview ? t("builder.backToEditor") : t("builder.preview")}
            </Button>
          </div>
        </div>
      </div>

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
                  {t(`contentTypes.${typeConfig.type}.label`)}
                </p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

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
