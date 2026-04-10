"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2, BookOpen, Users, FileText, LayoutGrid } from "lucide-react";
import { Button, buttonVariants, Badge } from "@repo/ui";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import {
  getAdminTrainingDetail,
  deleteChapter,
  deleteTraining,
  reorderChapters,
} from "@/services/admin-service";
import type { AdminChapter } from "@/types/admin";
import type { TrainingDetailViewProps } from "@/types/admin-props";
import { ChapterFormDialog } from "./chapter-form-dialog";
import { MetaCard } from "./meta-card";
import { AdminChapterList } from "./admin-chapter-list";
import { AdminExamList } from "./admin-exam-list";
import { TrainingStatCard } from "./training-stat-card";
import { PageBreadcrumb } from "../page-breadcrumb";

export function TrainingDetailView({ trainingId }: TrainingDetailViewProps) {
  const router = useRouter();
  const [chapterDialogOpen, setChapterDialogOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<AdminChapter | null>(null);

  const { data: training, isLoading, refetch } = useApiQuery(
    () => getAdminTrainingDetail(trainingId),
    { enabled: true },
  );

  const { mutateAsync: removeChapter } = useApiMutation(
    (chapterId: string) => deleteChapter(trainingId, chapterId),
    { onSuccess: () => refetch() },
  );

  const { mutateAsync: removeTraining } = useApiMutation(
    () => deleteTraining(trainingId),
    { onSuccess: () => router.push("/admin/trainings") },
  );

  const { mutateAsync: doReorder } = useApiMutation(
    (chapterIds: string[]) => reorderChapters(trainingId, chapterIds),
    { onSuccess: () => refetch() },
  );

  const handleDeleteChapter = useCallback(
    async (ch: AdminChapter) => {
      if (!confirm(`Delete chapter "${ch.title}"?`)) return;
      await removeChapter(ch.id);
    },
    [removeChapter],
  );

  const handleDeleteTraining = useCallback(async () => {
    if (!confirm("Delete this training? This action will soft-delete it.")) return;
    await removeTraining();
  }, [removeTraining]);

  if (isLoading || !training) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        Loading training details...
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageBreadcrumb
        backHref="/admin/trainings"
        backLabel="Back"
        items={[
          { label: "Manage Trainings", href: "/admin/trainings" },
          { label: training.title },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {training.title}
            </h1>
            {training.isDeleted && (
              <Badge variant="destructive">Deleted</Badge>
            )}
            {training.isMandatory && (
              <Badge variant="outline" className="border-destructive/30 text-destructive">
                Mandatory
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{training.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {!training.isDeleted && (
            <Link href={`/admin/trainings/${trainingId}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Pencil className="mr-1 h-4 w-4" />
              Edit
            </Link>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteTraining}
            disabled={training.isDeleted}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetaCard label="Category" value={training.categoryName} />
        <MetaCard label="Badge Level" value={training.badgeLevel} />
        <MetaCard label="Credits" value={String(training.credits)} />
        <MetaCard label="Duration" value={training.duration || "N/A"} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <TrainingStatCard icon={BookOpen} iconBgClass="bg-[hsl(var(--ey-blue-400))]/10" iconColorClass="text-[hsl(var(--ey-blue-600))]" value={training.chapters.length} label="Chapters" />
        <TrainingStatCard icon={Users} iconBgClass="bg-[hsl(var(--ey-green-500))]/10" iconColorClass="text-[hsl(var(--ey-green-500))]" value={training.enrollmentCount} label="Enrolled" />
        <TrainingStatCard icon={FileText} iconBgClass="bg-[hsl(var(--ey-yellow))]/10" iconColorClass="text-[hsl(var(--ey-orange-500))]" value={training.exams.length} label="Exams" />
      </div>

      {/* Chapters */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Chapters</h2>
        {!training.isDeleted && (
          <Link
            href={`/admin/trainings/${trainingId}/chapters`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <LayoutGrid className="mr-1.5 h-4 w-4" />
            Manage Chapters
          </Link>
        )}
      </div>
      <AdminChapterList
        trainingId={trainingId}
        chapters={training.chapters}
        isDeleted={training.isDeleted}
        onAddChapter={() => { setEditingChapter(null); setChapterDialogOpen(true); }}
        onEditChapter={(ch) => { setEditingChapter(ch); setChapterDialogOpen(true); }}
        onDeleteChapter={handleDeleteChapter}
        onReorder={doReorder}
        onRefetch={refetch}
      />

      {/* Exams */}
      <AdminExamList exams={training.exams} />

      <ChapterFormDialog trainingId={trainingId} chapter={editingChapter} open={chapterDialogOpen} onOpenChange={setChapterDialogOpen} onSaved={refetch} />
    </div>
  );
}
