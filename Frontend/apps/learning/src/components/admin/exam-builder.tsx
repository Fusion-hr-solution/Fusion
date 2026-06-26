"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Plus,
  Trash2,
  Eye,
  Pencil,
  ClipboardList,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button, Card, CardContent, Badge } from "@repo/ui";
import { useExamBuilder } from "@/hooks/use-exam-builder";
import { PageBreadcrumb } from "../page-breadcrumb";
import { QuestionFormDialog } from "./question-form-dialog";
import { ExamPreviewDialog } from "./exam-preview-dialog";
import { ExamSettingsForm } from "./exam-settings-form";
import { QuestionCard } from "./question-card";
import { ExamSettingsDialog } from "./exam-settings-dialog";
import { AiQuizPanel } from "./quiz/ai-quiz-panel";

export function ExamBuilder({ trainingId }: { trainingId: string }) {
  const router = useRouter();
  const t = useTranslations("adminExam");
  const tQuiz = useTranslations("adminQuiz");
  const builder = useExamBuilder(trainingId);
  const {
    exam,
    questions,
    isLoading,
    isCreating,
    refetch,
    editingQuestion,
    questionDialogOpen,
    openQuestionDialog,
    closeQuestionDialog,
    handleCreateExam,
    handleUpdateExam,
    handleDeleteExam,
    handleAddQuestion,
    handleUpdateQuestion,
    handleDeleteQuestion,
  } = builder;

  const [showPreview, setShowPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAi, setShowAi] = useState(false);

  const aiPanel = (
    <AiQuizPanel
      open={showAi}
      onOpenChange={setShowAi}
      trainingId={trainingId}
      examExists={Boolean(exam)}
      onPublished={() => {
        setShowAi(false);
        refetch();
      }}
    />
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("builder.loading")}
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="space-y-6 p-6">
        <PageBreadcrumb
          backHref={`/admin/trainings/${trainingId}`}
          backLabel={t("builder.back")}
          items={[
            { label: t("builder.manageTrainings"), href: "/admin/trainings" },
            {
              label: t("builder.training"),
              href: `/admin/trainings/${trainingId}`,
            },
            { label: t("builder.createExam") },
          ]}
        />
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAi(true)}
            className="border-[var(--ey-yellow,#ffe600)]/60"
          >
            <Sparkles className="mr-1.5 h-4 w-4" /> {tQuiz("generateWithAi")}
          </Button>
        </div>
        <ExamSettingsForm
          mode="create"
          isLoading={isCreating}
          onSubmit={handleCreateExam}
          onCancel={() => router.push(`/admin/trainings/${trainingId}`)}
        />
        {aiPanel}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageBreadcrumb
        backHref={`/admin/trainings/${trainingId}`}
        backLabel={t("builder.back")}
        items={[
          { label: t("builder.manageTrainings"), href: "/admin/trainings" },
          {
            label: t("builder.training"),
            href: `/admin/trainings/${trainingId}`,
          },
          { label: t("builder.examBuilder") },
        ]}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {exam.title}
            </h1>
          </div>
          {exam.description && (
            <p className="text-sm text-muted-foreground">{exam.description}</p>
          )}
          <div className="flex items-center gap-3 pt-1">
            <Badge variant="outline">
              {t("builder.pass", { score: exam.passingScore })}
            </Badge>
            {exam.durationMinutes && (
              <Badge variant="outline">
                {t("builder.minutes", { minutes: exam.durationMinutes })}
              </Badge>
            )}
            <Badge variant="outline">
              {t("builder.questionsCount", { count: questions.length })}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(true)}
            disabled={questions.length === 0}
          >
            <Eye className="mr-1.5 h-4 w-4" /> {t("builder.preview")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(true)}
          >
            <Pencil className="mr-1.5 h-4 w-4" /> {t("builder.settings")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteExam}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <Trash2 className="mr-1.5 h-4 w-4" /> {t("builder.delete")}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            {t("builder.questionsHeading")}
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAi(true)}
              className="border-[var(--ey-yellow,#ffe600)]/60"
            >
              <Sparkles className="mr-1.5 h-4 w-4" /> {tQuiz("generateWithAi")}
            </Button>
            <Button
              size="sm"
              onClick={() => openQuestionDialog(null)}
              className="ey-bg-dark hover:opacity-90"
            >
              <Plus className="mr-1.5 h-4 w-4" /> {t("builder.addQuestion")}
            </Button>
          </div>
        </div>

        {questions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                {t("builder.emptyTitle")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {t("builder.emptyDescription")}
              </p>
              <Button
                size="sm"
                className="mt-4 ey-bg-dark hover:opacity-90"
                onClick={() => openQuestionDialog(null)}
              >
                <Plus className="mr-1.5 h-4 w-4" /> {t("builder.addQuestion")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {questions.map((q, index) => (
              <QuestionCard
                key={q.id}
                question={q}
                index={index}
                onEdit={() => openQuestionDialog(q)}
                onDelete={() => handleDeleteQuestion(q)}
              />
            ))}
          </div>
        )}
      </div>

      <QuestionFormDialog
        open={questionDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeQuestionDialog();
        }}
        question={editingQuestion}
        onSubmit={async (input) => {
          if (editingQuestion) {
            await handleUpdateQuestion(editingQuestion.id, input);
          } else {
            await handleAddQuestion(input);
          }
          closeQuestionDialog();
        }}
      />
      <ExamPreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        exam={exam}
        questions={questions}
      />
      {showSettings && (
        <ExamSettingsDialog
          open={showSettings}
          onOpenChange={setShowSettings}
          exam={exam}
          onSubmit={async (input) => {
            await handleUpdateExam(input);
            setShowSettings(false);
          }}
        />
      )}
      {aiPanel}
    </div>
  );
}
