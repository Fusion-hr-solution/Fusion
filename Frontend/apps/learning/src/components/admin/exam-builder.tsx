"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Eye,
  Pencil,
  GripVertical,
  ClipboardList,
  Loader2,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import { useExamBuilder } from "@/hooks/use-exam-builder";
import type {
  AdminExamQuestion,
  UpdateExamInput,
} from "@/types/admin";
import { PageBreadcrumb } from "../page-breadcrumb";
import { QuestionFormDialog } from "./question-form-dialog";
import { ExamPreviewDialog } from "./exam-preview-dialog";
import { ExamSettingsForm } from "./exam-settings-form";

export function ExamBuilder({ trainingId }: { trainingId: string }) {
  const router = useRouter();
  const builder = useExamBuilder(trainingId);
  const {
    exam,
    questions,
    isLoading,
    isCreating,
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading exam...
      </div>
    );
  }

  // --- No exam yet → show creation form ---
  if (!exam) {
    return (
      <div className="space-y-6 p-6">
        <PageBreadcrumb
          backHref={`/admin/trainings/${trainingId}`}
          backLabel="Back"
          items={[
            { label: "Manage Trainings", href: "/admin/trainings" },
            { label: "Training", href: `/admin/trainings/${trainingId}` },
            { label: "Create Exam" },
          ]}
        />
        <ExamSettingsForm
          mode="create"
          isLoading={isCreating}
          onSubmit={handleCreateExam}
          onCancel={() => router.push(`/admin/trainings/${trainingId}`)}
        />
      </div>
    );
  }

  // --- Exam exists → show builder ---
  return (
    <div className="space-y-6 p-6">
      <PageBreadcrumb
        backHref={`/admin/trainings/${trainingId}`}
        backLabel="Back"
        items={[
          { label: "Manage Trainings", href: "/admin/trainings" },
          { label: "Training", href: `/admin/trainings/${trainingId}` },
          { label: "Exam Builder" },
        ]}
      />

      {/* Exam header */}
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
            <Badge variant="outline">Pass: {exam.passingScore}%</Badge>
            {exam.durationMinutes && (
              <Badge variant="outline">{exam.durationMinutes} min</Badge>
            )}
            <Badge variant="outline">{questions.length} questions</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPreview(true)} disabled={questions.length === 0}>
            <Eye className="mr-1.5 h-4 w-4" />
            Preview
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Settings
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteExam}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Questions list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Questions</h2>
          <Button size="sm" onClick={() => openQuestionDialog(null)} className="ey-bg-dark hover:opacity-90">
            <Plus className="mr-1.5 h-4 w-4" />
            Add Question
          </Button>
        </div>

        {questions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">No questions yet</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Add your first question to start building the exam
              </p>
              <Button
                size="sm"
                className="mt-4 ey-bg-dark hover:opacity-90"
                onClick={() => openQuestionDialog(null)}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add Question
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

      {/* Question form dialog */}
      <QuestionFormDialog
        open={questionDialogOpen}
        onOpenChange={(open) => { if (!open) closeQuestionDialog(); }}
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

      {/* Preview dialog */}
      <ExamPreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        exam={exam}
        questions={questions}
      />

      {/* Settings dialog */}
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
    </div>
  );
}

// --- Question Card ---

function QuestionCard({
  question,
  index,
  onEdit,
  onDelete,
}: {
  question: AdminExamQuestion;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const typeLabel: Record<string, string> = {
    SingleChoice: "Single Choice",
    MultipleChoice: "Multiple Choice",
    TrueFalse: "True / False",
  };

  return (
    <Card className="border-border/60 transition-colors hover:border-border">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-2 pt-0.5 text-muted-foreground">
            <GripVertical className="h-4 w-4" />
            <span className="text-xs font-semibold tabular-nums w-5">{index + 1}</span>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-foreground leading-snug">
                {question.questionText}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onEdit}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={onDelete}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {typeLabel[question.type] ?? question.type}
              </Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {question.points} {question.points === 1 ? "pt" : "pts"}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {question.options.length} options
              </span>
            </div>

            {/* Options preview */}
            <div className="grid gap-1 pt-1">
              {question.options.map((opt) => (
                <div
                  key={opt.id}
                  className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${
                    opt.isCorrect
                      ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                      : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 shrink-0 rounded-full border ${
                      opt.isCorrect
                        ? "border-green-500 bg-green-500"
                        : "border-border"
                    }`}
                  />
                  {opt.optionText}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Exam Settings Dialog (inline, for editing existing exam) ---

function ExamSettingsDialog({
  open,
  onOpenChange,
  exam,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: { title: string; description?: string; passingScore: number; durationMinutes?: number };
  onSubmit: (input: UpdateExamInput) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exam Settings</DialogTitle>
        </DialogHeader>
        <ExamSettingsForm
          mode="edit"
          initialValues={exam}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
