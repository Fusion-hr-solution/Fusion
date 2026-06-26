"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import { ApiError } from "@repo/api";
import type {
  AdminExamQuestion,
  QuestionType,
  CreateExamQuestionInput,
  UpdateExamQuestionInput,
} from "@/types/admin";
import {
  QuestionOptionsEditor,
  type OptionDraft,
} from "./question-options-editor";

const QUESTION_TYPES: {
  value: QuestionType;
  labelKey: "SingleChoice" | "MultipleChoice" | "TrueFalse";
}[] = [
  { value: "SingleChoice", labelKey: "SingleChoice" },
  { value: "MultipleChoice", labelKey: "MultipleChoice" },
  { value: "TrueFalse", labelKey: "TrueFalse" },
];

let nextClientId = 1;
function genId() {
  return `opt-${nextClientId++}`;
}

function defaultOptions(type: QuestionType): OptionDraft[] {
  if (type === "TrueFalse")
    return [
      { clientId: genId(), optionText: "True", isCorrect: true },
      { clientId: genId(), optionText: "False", isCorrect: false },
    ];
  return [
    { clientId: genId(), optionText: "", isCorrect: true },
    { clientId: genId(), optionText: "", isCorrect: false },
  ];
}

interface QuestionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: AdminExamQuestion | null;
  onSubmit: (
    input: CreateExamQuestionInput | UpdateExamQuestionInput
  ) => Promise<void>;
}

export function QuestionFormDialog({
  open,
  onOpenChange,
  question,
  onSubmit,
}: QuestionFormDialogProps) {
  const t = useTranslations("adminExam");
  const isEditing = Boolean(question);
  const [questionText, setQuestionText] = useState("");
  const [type, setType] = useState<QuestionType>("SingleChoice");
  const [points, setPoints] = useState(1);
  const [explanation, setExplanation] = useState("");
  const [options, setOptions] = useState<OptionDraft[]>(() =>
    defaultOptions("SingleChoice")
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (question) {
      setQuestionText(question.questionText);
      setType(question.type);
      setPoints(question.points);
      setExplanation(question.explanation ?? "");
      setOptions(
        question.options.map((o) => ({
          clientId: genId(),
          optionText: o.optionText,
          isCorrect: o.isCorrect,
        }))
      );
    } else {
      setQuestionText("");
      setType("SingleChoice");
      setPoints(1);
      setExplanation("");
      setOptions(defaultOptions("SingleChoice"));
    }
    setError(null);
    // Reset the in-flight flag so reopening after a successful submit isn't stuck disabled
    // (the parent owns closing; this dialog stays mounted and is reused for repeated adds).
    setSaving(false);
  }, [open, question]);

  const handleTypeChange = useCallback(
    (newType: QuestionType) => {
      setType(newType);
      if (newType === "TrueFalse") {
        setOptions([
          { clientId: genId(), optionText: "True", isCorrect: true },
          { clientId: genId(), optionText: "False", isCorrect: false },
        ]);
      } else if (type === "TrueFalse") {
        setOptions(defaultOptions(newType));
      }
      if (newType === "SingleChoice") {
        setOptions((prev) => {
          const fi = prev.findIndex((o) => o.isCorrect);
          return prev.map((o, i) => ({
            ...o,
            isCorrect: i === (fi >= 0 ? fi : 0),
          }));
        });
      }
    },
    [type]
  );

  const handleToggleCorrect = useCallback(
    (clientId: string) => {
      setOptions((prev) => {
        if (type === "SingleChoice" || type === "TrueFalse")
          return prev.map((o) => ({
            ...o,
            isCorrect: o.clientId === clientId,
          }));
        return prev.map((o) =>
          o.clientId === clientId ? { ...o, isCorrect: !o.isCorrect } : o
        );
      });
    },
    [type]
  );

  const handleOptionTextChange = useCallback(
    (clientId: string, text: string) => {
      setOptions((prev) =>
        prev.map((o) =>
          o.clientId === clientId ? { ...o, optionText: text } : o
        )
      );
    },
    []
  );

  const optionsFilled = options.every((o) => o.optionText.trim().length > 0);
  const hasCorrect = options.some((o) => o.isCorrect);
  const canSubmit =
    questionText.trim().length > 0 &&
    options.length >= 2 &&
    optionsFilled &&
    hasCorrect &&
    points >= 1 &&
    !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        questionText: questionText.trim(),
        type,
        points,
        explanation: explanation.trim() || undefined,
        options: options.map((o) => ({
          optionText: o.optionText.trim(),
          isCorrect: o.isCorrect,
        })),
      });
    } catch (err) {
      if (err instanceof ApiError) setError(err.errors[0] ?? err.message);
      else if (err instanceof Error) setError(err.message);
      else setError(t("questionDialog.unexpectedError"));
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t("questionDialog.editTitle")
              : t("questionDialog.addTitle")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-[13px] font-semibold">
              {t("questionDialog.questionLabel")}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder={t("questionDialog.questionPlaceholder")}
              maxLength={1000}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[13px] font-semibold">
                {t("questionDialog.questionTypeLabel")}
              </Label>
              <Select
                value={type}
                onValueChange={(v) => handleTypeChange(v as QuestionType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((qt) => (
                    <SelectItem key={qt.value} value={qt.value}>
                      {t(`questionType.${qt.labelKey}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-semibold">
                {t("questionDialog.pointsLabel")}
              </Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
              />
            </div>
          </div>
          <QuestionOptionsEditor
            options={options}
            type={type}
            onToggleCorrect={handleToggleCorrect}
            onOptionTextChange={handleOptionTextChange}
            onAddOption={() =>
              setOptions((prev) => [
                ...prev,
                { clientId: genId(), optionText: "", isCorrect: false },
              ])
            }
            onRemoveOption={(id) =>
              setOptions((prev) => prev.filter((o) => o.clientId !== id))
            }
          />
          <div className="space-y-2">
            <Label className="text-[13px] font-semibold">
              {t("questionDialog.explanationLabel")}
            </Label>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder={t("questionDialog.explanationPlaceholder")}
              maxLength={2000}
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              {t("questionDialog.cancel")}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!canSubmit}
              className="ey-bg-dark hover:opacity-90"
            >
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {isEditing
                ? t("questionDialog.updateQuestion")
                : t("questionDialog.addQuestion")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
