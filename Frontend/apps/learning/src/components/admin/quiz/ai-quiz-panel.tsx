"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Upload,
  Save,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  Badge,
} from "@repo/ui";
import { ApiError } from "@repo/api";
import { useQuizGenerator } from "@/hooks/use-quiz-generator";
import type {
  AdminExamQuestion,
  CreateExamQuestionInput,
  QuizDraftQuestion,
  QuizDraftQuestionInput,
  UpdateExamQuestionInput,
} from "@/types/admin";
import { QuestionFormDialog } from "../question-form-dialog";

const QUESTION_TYPE_KEYS = [
  "SingleChoice",
  "MultipleChoice",
  "TrueFalse",
] as const;

function extractError(err: unknown): string | undefined {
  if (err instanceof ApiError) return err.errors[0] ?? err.message;
  if (err instanceof Error) return err.message;
  return undefined;
}

/** A draft question is publishable when it would pass the backend's per-question rules. */
function isQuestionValid(q: QuizDraftQuestion): boolean {
  if (!q.text.trim()) return false;
  // Mirror the exam column limits so the Publish button gates before the backend can 500.
  if (q.text.trim().length > 1000) return false;
  if (q.options.length < 2) return false;
  if (q.options.some((o) => !o.text.trim())) return false;
  if (q.options.some((o) => o.text.trim().length > 500)) return false;
  const correct = q.options.filter((o) => o.isCorrect).length;
  if (correct < 1) return false;
  if (q.type === "SingleChoice" && correct !== 1) return false;
  if (q.type === "TrueFalse" && q.options.length !== 2) return false;
  return true;
}

function toAdminQuestion(q: QuizDraftQuestion, idx: number): AdminExamQuestion {
  return {
    id: `draft-${idx}`,
    questionText: q.text,
    type: q.type,
    orderIndex: q.order,
    points: q.points,
    explanation: q.explanation,
    options: q.options.map((o, oi) => ({
      id: `draft-${idx}-opt-${oi}`,
      optionText: o.text,
      isCorrect: o.isCorrect,
      orderIndex: oi,
    })),
  };
}

function fromInput(
  input: CreateExamQuestionInput | UpdateExamQuestionInput,
  prev?: QuizDraftQuestion
): QuizDraftQuestion {
  return {
    text: input.questionText,
    type: input.type,
    points: input.points,
    explanation: input.explanation,
    order: prev?.order ?? 0,
    source: prev?.source ?? "manual",
    options: input.options.map((o) => ({
      text: o.optionText,
      isCorrect: o.isCorrect,
    })),
  };
}

function toInputs(qs: QuizDraftQuestion[]): QuizDraftQuestionInput[] {
  return qs.map((q) => ({
    text: q.text,
    type: q.type,
    points: q.points,
    explanation: q.explanation,
    source: q.source,
    options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
  }));
}

interface AiQuizPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainingId: string;
  examExists: boolean;
  onPublished: () => void;
}

export function AiQuizPanel({
  open,
  onOpenChange,
  trainingId,
  examExists,
  onPublished,
}: AiQuizPanelProps) {
  const t = useTranslations("adminQuiz");
  const {
    draft,
    isLoading,
    refetch,
    doGenerate,
    isGenerating,
    doSave,
    isSaving,
    doPublish,
    isPublishing,
    doDiscard,
    isDiscarding,
  } = useQuizGenerator(trainingId, open);

  const [working, setWorking] = useState<QuizDraftQuestion[]>([]);
  const [count, setCount] = useState(10);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Seed the working copy from the persisted draft exactly once per open, so a late-arriving draft
  // (or any later refetch) can't clobber edits the admin has already made this session.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!open) {
      seededRef.current = false;
      return;
    }
    if (draft && !seededRef.current) {
      seededRef.current = true;
      setWorking(draft.questions);
    }
  }, [open, draft]);

  const aiAvailable = draft?.aiAvailable ?? false;
  const invalidCount = working.filter((q) => !isQuestionValid(q)).length;
  const busy = isGenerating || isSaving || isPublishing || isDiscarding;

  async function handleGenerate() {
    try {
      const result = await doGenerate(count);
      setWorking(result.questions);
      toast.success(t("generated", { count: result.questions.length }));
    } catch (err) {
      toast.error(t("genError"), { description: extractError(err) });
    }
  }

  async function handleSave() {
    try {
      const saved = await doSave(toInputs(working));
      setWorking(saved.questions);
      toast.success(t("saved"));
    } catch (err) {
      toast.error(t("saveError"), { description: extractError(err) });
    }
  }

  async function handlePublish() {
    if (working.length === 0) return;
    if (!confirm(t("confirmPublish", { count: working.length }))) return;
    try {
      const res = await doPublish(toInputs(working));
      toast.success(t("published", { count: res.publishedCount }));
      setWorking([]);
      await refetch(); // draft was cleared server-side — sync the cache so a reopen doesn't show stale questions
      onPublished();
    } catch (err) {
      toast.error(t("publishError"), { description: extractError(err) });
    }
  }

  async function handleDiscard() {
    if (!confirm(t("confirmDiscard"))) return;
    try {
      await doDiscard();
      setWorking([]);
      await refetch();
      toast.success(t("discarded"));
    } catch (err) {
      toast.error(t("discardError"), { description: extractError(err) });
    }
  }

  function handleEditorSubmit(
    input: CreateExamQuestionInput | UpdateExamQuestionInput
  ) {
    setWorking((prev) => {
      if (editingIndex !== null) {
        const next = prev.slice();
        next[editingIndex] = fromInput(input, prev[editingIndex]);
        return next;
      }
      return [...prev, fromInput(input)];
    });
    setEditorOpen(false);
    setEditingIndex(null);
    return Promise.resolve();
  }

  const editingDraft =
    editingIndex !== null ? working[editingIndex] : undefined;

  // Stable identity so an unrelated parent re-render can't reset an in-progress edit in the dialog.
  const editingQuestionForDialog = useMemo(
    () =>
      editingDraft && editingIndex !== null
        ? toAdminQuestion(editingDraft, editingIndex)
        : null,
    [editingDraft, editingIndex]
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[var(--ey-yellow,#ffe600)]" />
              {t("title")}
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">{t("description")}</p>

          {!isLoading && !aiAvailable && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300/40 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t("unavailable")}</span>
            </div>
          )}

          {/* Generation controls */}
          <div className="flex flex-wrap items-end gap-3 rounded-md border border-border/60 bg-muted/30 p-3">
            <div className="space-y-1">
              <Label className="text-[12px] font-semibold">
                {t("countLabel")}
              </Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) =>
                  setCount(
                    Math.max(1, Math.min(20, Number(e.target.value) || 1))
                  )
                }
                className="h-9 w-24"
                disabled={!aiAvailable || busy || isLoading}
              />
            </div>
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={!aiAvailable || busy}
              className="ey-bg-dark hover:opacity-90"
            >
              {isGenerating ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-4 w-4" />
              )}
              {working.length > 0 ? t("regenerate") : t("generate")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingIndex(null);
                setEditorOpen(true);
              }}
              disabled={busy || isLoading}
            >
              <Plus className="mr-1.5 h-4 w-4" /> {t("addManually")}
            </Button>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> {t("loading")}
            </div>
          )}

          {isGenerating && (
            <div className="flex flex-col items-center justify-center gap-1 py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p>{t("generating")}</p>
              <p className="text-xs text-muted-foreground/70">
                {t("generatingHint")}
              </p>
            </div>
          )}

          {/* Question list */}
          {!isLoading && !isGenerating && working.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-10 text-center">
              <Sparkles className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                {t("emptyTitle")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {t("emptyDescription")}
              </p>
            </div>
          ) : (
            !isLoading &&
            !isGenerating && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    {t("questionsCount", { count: working.length })}
                  </p>
                  {invalidCount > 0 && (
                    <span className="text-[11px] text-destructive">
                      {t("invalidHint", { count: invalidCount })}
                    </span>
                  )}
                </div>
                {working.map((q, idx) => {
                  const valid = isQuestionValid(q);
                  const typeLabel = (
                    QUESTION_TYPE_KEYS as readonly string[]
                  ).includes(q.type)
                    ? t(`type.${q.type}` as "type.SingleChoice")
                    : q.type;
                  return (
                    <div
                      key={idx}
                      className={`rounded-md border p-3 ${valid ? "border-border/60" : "border-destructive/50 bg-destructive/5"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">
                          <span className="mr-1.5 text-xs font-semibold tabular-nums text-muted-foreground">
                            {idx + 1}.
                          </span>
                          {q.text || (
                            <span className="italic text-muted-foreground">
                              {t("untitled")}
                            </span>
                          )}
                        </p>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              setEditingIndex(idx);
                              setEditorOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() =>
                              setWorking((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {typeLabel}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {t("points", { count: q.points })}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {q.source === "ai" ? t("sourceAi") : t("sourceManual")}
                        </Badge>
                      </div>
                      <div className="mt-2 grid gap-1">
                        {q.options.map((o, oi) => (
                          <div
                            key={oi}
                            className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${o.isCorrect ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400" : "bg-muted/50 text-muted-foreground"}`}
                          >
                            <span
                              className={`inline-block h-3 w-3 shrink-0 rounded-full border ${o.isCorrect ? "border-green-500 bg-green-500" : "border-border"}`}
                            />
                            {o.text || (
                              <span className="italic opacity-60">
                                {t("emptyOption")}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      {q.explanation && (
                        <p className="mt-1.5 text-[11px] italic text-muted-foreground">
                          <span className="font-semibold not-italic">
                            {t("explanationLabel")}:
                          </span>{" "}
                          {q.explanation}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Footer actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDiscard}
              disabled={busy || working.length === 0}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> {t("discard")}
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={busy || working.length === 0}
              >
                {isSaving ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-4 w-4" />
                )}
                {t("saveDraft")}
              </Button>
              <Button
                size="sm"
                onClick={handlePublish}
                disabled={busy || working.length === 0 || invalidCount > 0}
                className="ey-bg-dark hover:opacity-90"
              >
                {isPublishing ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-1.5 h-4 w-4" />
                )}
                {examExists ? t("publishExisting") : t("publish")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <QuestionFormDialog
        open={editorOpen}
        onOpenChange={(o) => {
          if (!o) {
            setEditorOpen(false);
            setEditingIndex(null);
          }
        }}
        question={editingQuestionForDialog}
        onSubmit={handleEditorSubmit}
      />
    </>
  );
}
