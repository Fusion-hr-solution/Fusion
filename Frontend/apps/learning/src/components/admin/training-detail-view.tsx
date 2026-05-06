"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2, BookOpen, Users, FileText, Plus } from "lucide-react";
import { Button, buttonVariants, Badge } from "@repo/ui";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import {
  getAdminTrainingDetail,
  addChapter,
  deleteChapter,
  deleteTraining,
  reorderChapters,
} from "@/services/admin-service";
import type { AdminChapter, CreateChapterInput } from "@/types/admin";
import type { TrainingDetailViewProps } from "@/types/admin-props";
import type { ChapterLayout } from "@/types";
import { ChapterFormDialog } from "./chapter-form-dialog";
import { MetaCard } from "./meta-card";
import { ChapterManagerList } from "./chapter-manager-list";
import { AdminExamList } from "./admin-exam-list";
import { AdminOnSiteCourseList } from "./admin-onsite-course-list";
import { PartsManagerSection } from "./sessions/parts-manager-section";
import { TrainingStatCard } from "./training-stat-card";
import { PageBreadcrumb } from "../page-breadcrumb";

export function TrainingDetailView({ trainingId }: TrainingDetailViewProps) {
  const router = useRouter();
  const [chapterDialogOpen, setChapterDialogOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<AdminChapter | null>(null);

  const fetchTrainingDetail = useCallback(
    () => getAdminTrainingDetail(trainingId),
    [trainingId],
  );

  const { data: training, isLoading, refetch } = useApiQuery(
    fetchTrainingDetail,
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

  const { mutateAsync: doDuplicate } = useApiMutation(
    (input: CreateChapterInput) => addChapter(trainingId, input),
    { onSuccess: () => refetch() },
  );

  const handleDeleteChapter = useCallback(
    async (ch: AdminChapter) => {
      if (!confirm(`Delete chapter "${ch.title}"?`)) return;
      await removeChapter(ch.id);
    },
    [removeChapter],
  );

  const handleDuplicateChapter = useCallback(
    async (ch: AdminChapter) => {
      await doDuplicate({
        title: `${ch.title} (copy)`,
        layout: ch.layout as ChapterLayout,
        orderIndex: (training?.chapters.length ?? 0),
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
            <Badge variant="outline" className={training.trainingType === "OnSite" ? "border-blue-500/30 text-blue-600" : "border-green-500/30 text-green-600"}>
              {training.trainingType === "OnSite" ? "On-Site" : "E-Learning"}
            </Badge>
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
        {training.trainingType === "OnSite" && training.scheduledDate && (
          <MetaCard label="Scheduled Date" value={new Date(training.scheduledDate).toLocaleString()} />
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {training.trainingType === "OnSite" ? (
          <>
            <TrainingStatCard icon={FileText} iconBgClass="bg-[hsl(var(--ey-blue-400))]/10" iconColorClass="text-[hsl(var(--ey-blue-600))]" value={training.onSiteCourses.length} label="Courses" />
            <TrainingStatCard icon={Users} iconBgClass="bg-[hsl(var(--ey-green-500))]/10" iconColorClass="text-[hsl(var(--ey-green-500))]" value={training.enrollmentCount} label="Enrolled" />
          </>
        ) : (
          <>
            <TrainingStatCard icon={BookOpen} iconBgClass="bg-[hsl(var(--ey-blue-400))]/10" iconColorClass="text-[hsl(var(--ey-blue-600))]" value={training.chapters.length} label="Chapters" />
            <TrainingStatCard icon={Users} iconBgClass="bg-[hsl(var(--ey-green-500))]/10" iconColorClass="text-[hsl(var(--ey-green-500))]" value={training.enrollmentCount} label="Enrolled" />
            <TrainingStatCard icon={FileText} iconBgClass="bg-[hsl(var(--ey-yellow))]/10" iconColorClass="text-[hsl(var(--ey-orange-500))]" value={training.exams.length} label="Exams" />
          </>
        )}
      </div>

      {training.trainingType === "OnSite" ? (
        <>
          {/* Parts (séances) and Sessions */}
          <PartsManagerSection trainingId={trainingId} isDeleted={training.isDeleted} />

          {/* On-Site Courses */}
          <h2 className="text-base font-semibold text-foreground">Course Materials</h2>
          <AdminOnSiteCourseList
            trainingId={trainingId}
            courses={training.onSiteCourses}
            isDeleted={training.isDeleted}
            onRefetch={refetch}
          />
        </>
      ) : (
        <>
          {/* Chapters */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Chapters</h2>
            {!training.isDeleted && (
              <Button
                size="sm"
                onClick={() => { setEditingChapter(null); setChapterDialogOpen(true); }}
                className="ey-bg-dark hover:opacity-90"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add Chapter
              </Button>
            )}
          </div>
          <ChapterManagerList
            chapters={training.chapters}
            isDeleted={training.isDeleted}
            onReorder={doReorder}
            onEdit={(ch) => { setEditingChapter(ch); setChapterDialogOpen(true); }}
            onDelete={handleDeleteChapter}
            onDuplicate={handleDuplicateChapter}
            onOpen={handleOpenBuilder}
          />

          {/* Exams */}
          <AdminExamList trainingId={trainingId} exams={training.exams} isDeleted={training.isDeleted} />

          <ChapterFormDialog trainingId={trainingId} chapter={editingChapter} open={chapterDialogOpen} onOpenChange={setChapterDialogOpen} onSaved={refetch} />
        </>
      )}
    </div>
  );
}
