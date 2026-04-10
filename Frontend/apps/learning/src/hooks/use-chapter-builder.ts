"use client";

import { useState, useCallback, useMemo } from "react";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import {
  getAdminTrainingDetail,
  addContentBlock,
  updateContentBlock,
  deleteContentBlock,
  reorderContentBlocks,
  updateChapter,
  uploadChapterFile,
} from "@/services/admin-service";
import type { AdminContentBlock, CreateContentBlockInput, UpdateContentBlockInput, UpdateChapterInput } from "@/types/admin";

export function useChapterBuilder(trainingId: string, chapterId: string) {
  const [editingBlock, setEditingBlock] = useState<AdminContentBlock | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const { data: training, isLoading, refetch } = useApiQuery(
    () => getAdminTrainingDetail(trainingId),
    { enabled: true },
  );

  const chapter = useMemo(
    () => training?.chapters.find((c) => c.id === chapterId) ?? null,
    [training, chapterId],
  );

  const blocks = useMemo(
    () => (chapter?.contentBlocks ?? []).slice().sort((a, b) => a.orderIndex - b.orderIndex),
    [chapter],
  );

  // --- Mutations ---

  const { mutateAsync: doAddBlock } = useApiMutation(
    (input: CreateContentBlockInput) => addContentBlock(trainingId, chapterId, input),
    { onSuccess: () => refetch() },
  );

  const { mutateAsync: doUpdateBlock } = useApiMutation(
    ({ blockId, input }: { blockId: string; input: UpdateContentBlockInput }) =>
      updateContentBlock(trainingId, chapterId, blockId, input),
    { onSuccess: () => refetch() },
  );

  const { mutateAsync: doDeleteBlock } = useApiMutation(
    (blockId: string) => deleteContentBlock(trainingId, chapterId, blockId),
    { onSuccess: () => refetch() },
  );

  const { mutateAsync: doReorderBlocks } = useApiMutation(
    (ids: string[]) => reorderContentBlocks(trainingId, chapterId, ids),
    { onSuccess: () => refetch() },
  );

  const { mutateAsync: doUpdateChapter } = useApiMutation(
    (input: UpdateChapterInput) => updateChapter(trainingId, chapterId, input),
    { onSuccess: () => refetch() },
  );

  // --- Handlers ---

  const handleAddBlock = useCallback(
    async (contentType: string, index?: number) => {
      await doAddBlock({
        type: contentType,
        orderIndex: index ?? blocks.length,
      });
    },
    [doAddBlock, blocks.length],
  );

  const handleDeleteBlock = useCallback(
    async (block: AdminContentBlock) => {
      if (!confirm(`Delete "${block.title || block.type}" block?`)) return;
      await doDeleteBlock(block.id);
    },
    [doDeleteBlock],
  );

  const handleReorderBlocks = useCallback(
    async (ids: string[]) => {
      await doReorderBlocks(ids);
    },
    [doReorderBlocks],
  );

  const handleUpdateTitle = useCallback(
    async (title: string) => {
      if (!chapter) return;
      await doUpdateChapter({ title, layout: chapter.layout });
    },
    [chapter, doUpdateChapter],
  );

  const handleUpdateLayout = useCallback(
    async (layout: string) => {
      if (!chapter) return;
      await doUpdateChapter({ title: chapter.title, layout: layout as UpdateChapterInput["layout"] });
    },
    [chapter, doUpdateChapter],
  );

  const openEditor = useCallback((block: AdminContentBlock | null) => {
    setEditingBlock(block);
    setEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setEditingBlock(null);
  }, []);

  return {
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
    doUpdateBlock,
    uploadChapterFile,
  };
}
