"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, AlertTriangle } from "lucide-react";
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

interface OptionDraft {
  clientId: string;
  optionText: string;
  isCorrect: boolean;
}

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "SingleChoice", label: "Single Choice" },
  { value: "MultipleChoice", label: "Multiple Choice" },
  { value: "TrueFalse", label: "True / False" },
];

let nextClientId = 1;
function genId() {
  return `opt-${nextClientId++}`;
}

function defaultOptions(type: QuestionType): OptionDraft[] {
  if (type === "TrueFalse") {
    return [
      { clientId: genId(), optionText: "True", isCorrect: true },
      { clientId: genId(), optionText: "False", isCorrect: false },
    ];
  }
  return [
    { clientId: genId(), optionText: "", isCorrect: true },
    { clientId: genId(), optionText: "", isCorrect: false },
  ];
}

interface QuestionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: AdminExamQuestion | null;
  onSubmit: (input: CreateExamQuestionInput | UpdateExamQuestionInput) => Promise<void>;
}

export function QuestionFormDialog({
  open,
  onOpenChange,
  question,
  onSubmit,
}: QuestionFormDialogProps) {
  const isEditing = Boolean(question);

  const [questionText, setQuestionText] = useState("");
  const [type, setType] = useState<QuestionType>("SingleChoice");
  const [points, setPoints] = useState(1);
  const [options, setOptions] = useState<OptionDraft[]>(() => defaultOptions("SingleChoice"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens / question changes
  useEffect(() => {
    if (!open) return;
    if (question) {
      setQuestionText(question.questionText);
      setType(question.type);
      setPoints(question.points);
      setOptions(
        question.options.map((o) => ({
          clientId: genId(),
          optionText: o.optionText,
          isCorrect: o.isCorrect,
        })),
      );
    } else {
      setQuestionText("");
      setType("SingleChoice");
      setPoints(1);
      setOptions(defaultOptions("SingleChoice"));
    }
    setError(null);
  }, [open, question]);

  // When type changes, reset options accordingly
  const handleTypeChange = useCallback(
    (newType: QuestionType) => {
      setType(newType);
      if (newType === "TrueFalse") {
        setOptions([
          { clientId: genId(), optionText: "True", isCorrect: true },
          { clientId: genId(), optionText: "False", isCorrect: false },
        ]);
      } else if (type === "TrueFalse") {
        // Switching away from TrueFalse → reset to blank options
        setOptions(defaultOptions(newType));
      }
      // If switching between SingleChoice ↔ MultipleChoice, keep options but
      // for SingleChoice ensure only one is correct
      if (newType === "SingleChoice") {
        setOptions((prev) => {
          const firstCorrect = prev.findIndex((o) => o.isCorrect);
          return prev.map((o, i) => ({ ...o, isCorrect: i === (firstCorrect >= 0 ? firstCorrect : 0) }));
        });
      }
    },
    [type],
  );

  const handleOptionTextChange = useCallback((clientId: string, text: string) => {
    setOptions((prev) => prev.map((o) => (o.clientId === clientId ? { ...o, optionText: text } : o)));
  }, []);

  const handleToggleCorrect = useCallback(
    (clientId: string) => {
      setOptions((prev) => {
        if (type === "SingleChoice" || type === "TrueFalse") {
          // Radio-style: only one correct
          return prev.map((o) => ({ ...o, isCorrect: o.clientId === clientId }));
        }
        // MultipleChoice: toggle
        return prev.map((o) => (o.clientId === clientId ? { ...o, isCorrect: !o.isCorrect } : o));
      });
    },
    [type],
  );

  const handleAddOption = useCallback(() => {
    setOptions((prev) => [...prev, { clientId: genId(), optionText: "", isCorrect: false }]);
  }, []);

  const handleRemoveOption = useCallback((clientId: string) => {
    setOptions((prev) => prev.filter((o) => o.clientId !== clientId));
  }, []);

  // Validation
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
        options: options.map((o) => ({
          optionText: o.optionText.trim(),
          isCorrect: o.isCorrect,
        })),
      });
    } catch (err) {
      if (err instanceof ApiError) setError(err.errors[0] ?? err.message);
      else if (err instanceof Error) setError(err.message);
      else setError("An unexpected error occurred.");
      setSaving(false);
    }
  }

  const isTrueFalse = type === "TrueFalse";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Question" : "Add Question"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Question text */}
          <div className="space-y-2">
            <Label className="text-[13px] font-semibold">
              Question <span className="text-destructive">*</span>
            </Label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Enter your question..."
              maxLength={1000}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          {/* Type + Points row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[13px] font-semibold">Question Type</Label>
              <Select value={type} onValueChange={(v) => handleTypeChange(v as QuestionType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((qt) => (
                    <SelectItem key={qt.value} value={qt.value}>
                      {qt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-semibold">Points</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[13px] font-semibold">
                Options <span className="text-destructive">*</span>
              </Label>
              {!isTrueFalse && (
                <Button type="button" variant="outline" size="sm" onClick={handleAddOption} className="h-7 text-xs">
                  <Plus className="mr-1 h-3 w-3" />
                  Add Option
                </Button>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground">
              {type === "SingleChoice"
                ? "Select the one correct answer"
                : type === "MultipleChoice"
                  ? "Select all correct answers"
                  : "Select the correct answer"}
            </p>

            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={opt.clientId} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleCorrect(opt.clientId)}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      opt.isCorrect
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-border hover:border-muted-foreground"
                    }`}
                    aria-label={opt.isCorrect ? "Marked correct" : "Mark as correct"}
                  >
                    {opt.isCorrect && (
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  <Input
                    value={opt.optionText}
                    onChange={(e) => handleOptionTextChange(opt.clientId, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    maxLength={500}
                    disabled={isTrueFalse}
                    className="flex-1"
                  />

                  {!isTrueFalse && options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveOption(opt.clientId)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {!hasCorrect && options.length > 0 && (
              <p className="text-[11px] text-destructive">At least one option must be marked as correct</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!canSubmit} className="ey-bg-dark hover:opacity-90">
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Question" : "Add Question"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
