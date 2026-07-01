"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2, BookOpen, Users, FileText, Plus } from "lucide-react";
import { useTranslations, useFormatter } from "next-intl";
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
import { SessionCostsTab } from "./sessions/session-costs-tab";
import { TrainingStatCard } from "./training-stat-card";
import { TrainingFeedbackPanel } from "./feedback";
import { PageBreadcrumb } from "../page-breadcrumb";

export function TrainingDetailView({ trainingId }: TrainingDetailViewProps) {
  const router = useRouter();
  const t = useTranslations("adminTrainings");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const [chapterDialogOpen, setChapterDialogOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<AdminChapter | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<"details" | "feedback">("details");
  const [onSiteTab, setOnSiteTab] = useState<"sessions" | "materials" | "costs">("sessions");

  const fetchTrainingDetail = useCallback(
    () => getAdminTrainingDetail(trainingId),
    [trainingId]
  );

  const {
    data: training,
    isLoading,
    refetch,
  } = useApiQuery(fetchTrainingDetail, { enabled: true });

  const { mutateAsync: removeChapter } = useApiMutation(
    (chapterId: string) => deleteChapter(trainingId, chapterId),
    { onSuccess: () => refetch() }
  );

  const { mutateAsync: removeTraining } = useApiMutation(
    () => deleteTraining(trainingId),
    { onSuccess: () => router.push("/admin/trainings") }
  );

  const { mutateAsync: doReorder } = useApiMutation(
    (chapterIds: string[]) => reorderChapters(trainingId, chapterIds),
    { onSuccess: () => refetch() }
  );

  const { mutateAsync: doDuplicate } = useApiMutation(
    (input: CreateChapterInput) => addChapter(trainingId, input),
    { onSuccess: () => refetch() }
  );

  const handleDeleteChapter = useCallback(
    async (ch: AdminChapter) => {
      if (!confirm(t("detail.confirmDeleteChapter", { title: ch.title })))
        return;
      await removeChapter(ch.id);
    },
    [removeChapter, t]
  );

  const handleDuplicateChapter = useCallback(
    async (ch: AdminChapter) => {
      await doDuplicate({
        title: t("detail.copySuffix", { title: ch.title }),
        layout: ch.layout as ChapterLayout,
        orderIndex: training?.chapters.length ?? 0,
      });
    },
    [doDuplicate, training, t]
  );

  const handleOpenBuilder = useCallback(
    (ch: AdminChapter) => {
      router.push(`/admin/trainings/${trainingId}/chapters/${ch.id}`);
    },
    [router, trainingId]
  );

  const handleDeleteTraining = useCallback(async () => {
    if (!confirm(t("detail.confirmDeleteTraining"))) return;
    await removeTraining();
  }, [removeTraining, t]);

  if (isLoading || !training) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        {t("detail.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageBreadcrumb
        backHref="/admin/trainings"
        backLabel={tCommon("actions.back")}
        items={[
          { label: t("detail.manageTrainings"), href: "/admin/trainings" },
          { label: training.title },
        ]}
      />

      {/* Tabs */}
      <div className="inline-flex gap-1 rounded-xl border border-border/60 bg-card p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("details")}
          className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
            activeTab === "details"
              ? "ey-bg-dark text-white shadow-sm"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {t("detail.tabDetails")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("feedback")}
          className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
            activeTab === "feedback"
              ? "ey-bg-dark text-white shadow-sm"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {t("detail.tabFeedback")}
        </button>
      </div>

      {activeTab === "details" && (
        <>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {training.title}
            </h1>
            {training.isDeleted && (
              <Badge variant="destructive">{t("detail.deleted")}</Badge>
            )}
            {training.isMandatory && (
              <Badge
                variant="outline"
                className="border-destructive/30 text-destructive"
              >
                {t("detail.mandatory")}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={
                training.trainingType === "OnSite"
                  ? "border-[hsl(var(--ey-blue-500))]/30 text-[hsl(var(--ey-blue-500))]"
                  : "border-[hsl(var(--ey-green-500))]/30 text-[hsl(var(--ey-green-500))]"
              }
            >
              {training.trainingType === "OnSite"
                ? t("detail.onSite")
                : t("detail.eLearning")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {training.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!training.isDeleted && (
            <Link
              href={`/admin/trainings/${trainingId}/edit`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil className="mr-1 h-4 w-4" />
              {tCommon("actions.edit")}
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
            {tCommon("actions.delete")}
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetaCard
          label={t("detail.meta.category")}
          value={training.categoryName}
        />
        <MetaCard
          label={t("detail.meta.badgeLevel")}
          value={training.badgeLevel}
        />
        <MetaCard
          label={t("detail.meta.credits")}
          value={format.number(training.credits)}
        />
        <MetaCard
          label={t("detail.meta.duration")}
          value={training.duration || t("detail.meta.notAvailable")}
        />
        {training.trainingType === "OnSite" && training.scheduledDate && (
          <MetaCard
            label={t("detail.meta.scheduledDate")}
            value={format.dateTime(new Date(training.scheduledDate), {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          />
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {training.trainingType === "OnSite" ? (
          <>
            <TrainingStatCard
              icon={FileText}
              iconBgClass="bg-[hsl(var(--ey-blue-400))]/10"
              iconColorClass="text-[hsl(var(--ey-blue-600))]"
              value={training.onSiteCourses.length}
              label={t("detail.stats.courses")}
            />
            <TrainingStatCard
              icon={Users}
              iconBgClass="bg-[hsl(var(--ey-green-500))]/10"
              iconColorClass="text-[hsl(var(--ey-green-500))]"
              value={training.enrollmentCount}
              label={t("detail.stats.enrolled")}
            />
          </>
        ) : (
          <>
            <TrainingStatCard
              icon={BookOpen}
              iconBgClass="bg-[hsl(var(--ey-blue-400))]/10"
              iconColorClass="text-[hsl(var(--ey-blue-600))]"
              value={training.chapters.length}
              label={t("detail.stats.chapters")}
            />
            <TrainingStatCard
              icon={Users}
              iconBgClass="bg-[hsl(var(--ey-green-500))]/10"
              iconColorClass="text-[hsl(var(--ey-green-500))]"
              value={training.enrollmentCount}
              label={t("detail.stats.enrolled")}
            />
            <TrainingStatCard
              icon={FileText}
              iconBgClass="bg-[hsl(var(--ey-yellow))]/10"
              iconColorClass="text-[hsl(var(--ey-orange-500))]"
              value={training.exams.length}
              label={t("detail.stats.exams")}
            />
          </>
        )}
      </div>

      {training.trainingType === "OnSite" ? (
        <>
          {/* Tab bar — Costs tab only for External trainings */}
          <div className="flex items-center gap-1 border-b border-border">
            {[
              { key: "sessions" as const, label: t("detail.tabs.sessions") },
              { key: "materials" as const, label: t("detail.courseMaterials") },
              ...(training.costType === "External"
                ? [{ key: "costs" as const, label: t("detail.tabs.costs") }]
                : []),
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setOnSiteTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  onSiteTab === tab.key
                    ? "border-b-2 border-foreground text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {onSiteTab === "sessions" && (
            <PartsManagerSection trainingId={trainingId} isDeleted={training.isDeleted} />
          )}

          {onSiteTab === "materials" && (
            <>
              <h2 className="text-base font-semibold text-foreground">
                {t("detail.courseMaterials")}
              </h2>
              <AdminOnSiteCourseList
                trainingId={trainingId}
                courses={training.onSiteCourses}
                isDeleted={training.isDeleted}
                onRefetch={refetch}
              />
            </>
          )}

          {onSiteTab === "costs" && training.costType === "External" && (
            <SessionCostsTab trainingId={trainingId} />
          )}
        </>
      ) : (
        <>
          {/* Chapters */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              {t("detail.chaptersHeading")}
            </h2>
            {!training.isDeleted && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingChapter(null);
                  setChapterDialogOpen(true);
                }}
                className="ey-bg-dark hover:opacity-90"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                {t("detail.addChapter")}
              </Button>
            )}
          </div>
          <ChapterManagerList
            chapters={training.chapters}
            isDeleted={training.isDeleted}
            onReorder={doReorder}
            onEdit={(ch) => {
              setEditingChapter(ch);
              setChapterDialogOpen(true);
            }}
            onDelete={handleDeleteChapter}
            onDuplicate={handleDuplicateChapter}
            onOpen={handleOpenBuilder}
          />

          {/* Exams */}
          <AdminExamList
            trainingId={trainingId}
            exams={training.exams}
            isDeleted={training.isDeleted}
          />

          <ChapterFormDialog
            trainingId={trainingId}
            chapter={editingChapter}
            open={chapterDialogOpen}
            onOpenChange={setChapterDialogOpen}
            onSaved={refetch}
          />
        </>
      )}
        </>
      )}

      {activeTab === "feedback" && (
        <TrainingFeedbackPanel trainingId={trainingId} />
      )}
    </div>
  );
}
