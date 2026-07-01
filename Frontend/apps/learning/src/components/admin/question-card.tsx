"use client";

import { useTranslations } from "next-intl";
import { Pencil, Trash2, GripVertical } from "lucide-react";
import { Button, Card, CardContent, Badge } from "@repo/ui";
import type { AdminExamQuestion } from "@/types/admin";

const QUESTION_TYPE_KEYS = [
  "SingleChoice",
  "MultipleChoice",
  "TrueFalse",
] as const;

export function QuestionCard({
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
  const t = useTranslations("adminExam");
  const typeLabel = (QUESTION_TYPE_KEYS as readonly string[]).includes(
    question.type
  )
    ? t(`questionType.${question.type}` as "questionType.SingleChoice")
    : question.type;
  return (
    <Card className="border-border/60 transition-colors hover:border-border">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-2 pt-0.5 text-muted-foreground">
            <GripVertical className="h-4 w-4" />
            <span className="text-xs font-semibold tabular-nums w-5">
              {index + 1}
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-foreground leading-snug">
                {question.questionText}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={onEdit}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {typeLabel}
              </Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {t("card.points", { count: question.points })}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {t("card.optionsCount", { count: question.options.length })}
              </span>
            </div>
            <div className="grid gap-1 pt-1">
              {question.options.map((opt) => (
                <div
                  key={opt.id}
                  className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${opt.isCorrect ? "bg-[hsl(var(--ey-green-500))]/10 text-[hsl(var(--ey-green-500))]" : "bg-muted/50 text-muted-foreground"}`}
                >
                  <span
                    className={`inline-block h-3 w-3 shrink-0 rounded-full border ${opt.isCorrect ? "border-[hsl(var(--ey-green-500))] bg-[hsl(var(--ey-green-500))]" : "border-border"}`}
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
