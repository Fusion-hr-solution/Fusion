"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Plus,
  BookOpen,
  Users,
  GripVertical,
  Clock,
  FileText,
  Video,
} from "lucide-react";
import {
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import {
  getAdminTrainingDetail,
  deleteChapter,
  deleteTraining,
} from "@/services/admin-service";
import type { AdminChapter } from "@/types/admin";
import type { TrainingDetailViewProps } from "@/types/admin-props";
import { ChapterFormDialog } from "./chapter-form-dialog";
import { MetaCard } from "./meta-card";

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

  const contentTypeIcon = (type: string) =>
    type === "Video" ? <Video className="h-4 w-4" /> : <FileText className="h-4 w-4" />;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/admin/trainings")}
        className="text-muted-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to Trainings
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {training.title}
            </h1>
            {training.isDeleted && (
              <Badge variant="outline" className="border-[hsl(var(--ey-red-500))]/30 text-[hsl(var(--ey-red-500))]">
                Deleted
              </Badge>
            )}
            {training.isMandatory && (
              <Badge variant="outline" className="border-[hsl(var(--ey-red-500))]/30 text-[hsl(var(--ey-red-500))]">
                Mandatory
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{training.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/admin/trainings/${trainingId}/edit`)}
            disabled={training.isDeleted}
          >
            <Pencil className="mr-1 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteTraining}
            disabled={training.isDeleted}
            className="text-[hsl(var(--ey-red-500))] border-[hsl(var(--ey-red-500))]/30 hover:bg-[hsl(var(--ey-red-500))]/10"
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Metadata cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetaCard label="Category" value={training.categoryName} />
        <MetaCard label="Badge Level" value={training.badgeLevel} />
        <MetaCard label="Credits" value={String(training.credits)} />
        <MetaCard label="Duration" value={training.duration || "N/A"} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card className="border-border/60">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--ey-blue-400))]/10">
              <BookOpen className="h-4 w-4 text-[hsl(var(--ey-blue-600))]" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{training.chapters.length}</p>
              <p className="text-xs text-muted-foreground">Chapters</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--ey-green-500))]/10">
              <Users className="h-4 w-4 text-[hsl(var(--ey-green-500))]" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{training.enrollmentCount}</p>
              <p className="text-xs text-muted-foreground">Enrolled</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--ey-yellow))]/10">
              <FileText className="h-4 w-4 text-[hsl(var(--ey-orange-500))]" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{training.exams.length}</p>
              <p className="text-xs text-muted-foreground">Exams</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chapters */}
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Chapters</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setEditingChapter(null);
              setChapterDialogOpen(true);
            }}
            disabled={training.isDeleted}
            className="ey-bg-dark hover:opacity-90"
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Chapter
          </Button>
        </CardHeader>
        <CardContent>
          {training.chapters.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No chapters yet. Add one to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {[...training.chapters]
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((ch) => (
                  <div
                    key={ch.id}
                    className="flex items-center gap-3 rounded-lg border border-border/40 p-3 transition-colors hover:bg-[hsl(var(--ey-grey-100))]/30"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--ey-grey-200))] text-xs font-semibold text-muted-foreground">
                      {ch.orderIndex + 1}
                    </span>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {contentTypeIcon(ch.contentType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{ch.title}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span className="capitalize">{ch.contentType}</span>
                        {ch.estimatedDurationMinutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {ch.estimatedDurationMinutes} min
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingChapter(ch);
                          setChapterDialogOpen(true);
                        }}
                        disabled={training.isDeleted}
                        aria-label={`Edit ${ch.title}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteChapter(ch)}
                        disabled={training.isDeleted}
                        aria-label={`Delete ${ch.title}`}
                        className="text-[hsl(var(--ey-red-500))] hover:text-[hsl(var(--ey-red-500))] hover:bg-[hsl(var(--ey-red-500))]/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Exams (read-only) */}
      {training.exams.length > 0 && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Exams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {training.exams.map((exam) => (
                <div
                  key={exam.id}
                  className="flex items-center justify-between rounded-lg border border-border/40 p-3"
                >
                  <span className="text-sm font-medium text-foreground">{exam.title}</span>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{exam.questionCount} questions</span>
                    <span>Pass: {exam.passingScore}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chapter form dialog */}
      <ChapterFormDialog
        trainingId={trainingId}
        chapter={editingChapter}
        open={chapterDialogOpen}
        onOpenChange={setChapterDialogOpen}
        onSaved={refetch}
      />
    </div>
  );
}
