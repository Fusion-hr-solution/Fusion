"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@repo/ui";
import type { FeedbackQuestion } from "@/types";

interface FeedbackQuestionRowProps {
  question: FeedbackQuestion;
  onEdit: () => void;
  onRetire: () => void;
}

export function FeedbackQuestionRow({ question, onEdit, onRetire }: FeedbackQuestionRowProps) {
  const t = useTranslations("adminFeedback");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5 ${
        isDragging ? "opacity-60 shadow-md" : ""
      }`}
    >
      <button
        type="button"
        className="cursor-grab text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t("builder.drag")}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        {t(`questionType.${question.type}`)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{question.label}</span>
      <Button type="button" variant="ghost" size="sm" onClick={onEdit} aria-label={t("builder.edit")}>
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRetire}
        aria-label={t("builder.remove")}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
