"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, BookOpen } from "lucide-react";
import { Button } from "@repo/ui";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import {
  getAdminTrainingDetail,
  addChapter,
  deleteChapter,
  reorderChapters,
} from "@/services/admin-service";
import type { AdminChapter, CreateChapterInput } from "@/types/admin";
import type { ChapterLayout } from "@/types";
import { PageBreadcrumb } from "../page-breadcrumb";
import { ChapterManagerList } from "./chapter-manager-list";
import { ChapterFormDialog } from "./chapter-form-dialog";

export function ChapterManager({ trainingId }: { trainingId: string }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<AdminChapter | null>(null);

  const fetchTraining = useCallback(
    () => getAdminTrainingDetail(trainingId),
    [trainingId],
  );

  const { data: training, isLoading, refetch } = useApiQuery(
    fetchTraining,
    { enabled: true },
  );

  const { mutateAsync: doReorder } = useApiMutation(
    (ids: string[]) => reorderChapters(trainingId, ids),
    { onSuccess: () => refetch() },
  );

  const { mutateAsync: doDelete } = useApiMutation(
    (chapterId: string) => deleteChapter(trainingId, chapterId),
    { onSuccess: () => refetch() },
  );

  const { mutateAsync: doDuplicate } = useApiMutation(
    (input: CreateChapterInput) => addChapter(trainingId, input),
    { onSuccess: () => refetch() },
  );

  const handleDelete = useCallback(
    async (ch: AdminChapter) => {
      if (!confirm(`Delete chapter "${ch.title}"? This cannot be undone.`)) return;
      await doDelete(ch.id);
    },
    [doDelete],
  );

  const handleDuplicate = useCallback(
    async (ch: AdminChapter) => {
      const chapters = training?.chapters ?? [];
      await doDuplicate({
        title: `${ch.title} (copy)`,
        layout: ch.layout as ChapterLayout,
        orderIndex: chapters.length,
      });
    },
    [doDuplicate, training],
  );

  const handleOpenBuilder = useCallback(
    (ch: AdminChapter) => {
      router.push(`/admin/trainings/${trainingId}/chapters/${ch.id}`);
    },
    [router, trainingId],
  );

  if (isLoading || !training) {
    return (
      <div className="flex items-center justify-center py-32 text-sm text-muted-foreground">
        Loading chapters...
      </div>
    );
  }

  const sorted = [...training.chapters].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <PageBreadcrumb
        backHref={`/admin/trainings/${trainingId}`}
        backLabel="Training"
        items={[
          { label: "Trainings", href: "/admin/trainings" },
          { label: training.title, href: `/admin/trainings/${trainingId}` },
          { label: "Chapters" },
        ]}
      />

      {/* Header */}
      <div className="border-b border-border bg-background px-8 pb-6 pt-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Chapter Management
            </h1>
            <p className="text-sm text-muted-foreground">
              {training.title} · {sorted.length} chapter{sorted.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button
            onClick={() => { setEditingChapter(null); setDialogOpen(true); }}
            disabled={training.isDeleted}
            className="ey-bg-dark hover:opacity-90"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Chapter
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-8 py-6">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <BookOpen className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">No chapters yet</p>
              <p className="text-sm text-muted-foreground">
                Add your first chapter to start building the training content.
              </p>
            </div>
            <Button
              onClick={() => { setEditingChapter(null); setDialogOpen(true); }}
              className="ey-bg-dark hover:opacity-90"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add Chapter
            </Button>
          </div>
        ) : (
          <ChapterManagerList
            chapters={sorted}
            isDeleted={training.isDeleted}
            onReorder={doReorder}
            onEdit={(ch) => { setEditingChapter(ch); setDialogOpen(true); }}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            onOpen={handleOpenBuilder}
          />
        )}
      </div>

      <ChapterFormDialog
        trainingId={trainingId}
        chapter={editingChapter}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={refetch}
      />
    </div>
  );
}
