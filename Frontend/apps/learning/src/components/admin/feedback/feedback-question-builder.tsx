"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
} from "@repo/ui";
import type { FeedbackQuestion, FeedbackQuestionType } from "@/types";
import { useFeedbackConfig } from "@/hooks/use-feedback-config";
import { FeedbackQuestionRow } from "./feedback-question-row";
import { FeedbackQuestionDialog } from "./feedback-question-dialog";

const QUESTION_TYPES: FeedbackQuestionType[] = [
  "StarRating",
  "Scale10",
  "YesNo",
  "MultipleChoice",
  "FreeText",
];

interface FeedbackQuestionBuilderProps {
  categoryId?: string;
}

export function FeedbackQuestionBuilder({ categoryId }: FeedbackQuestionBuilderProps) {
  const t = useTranslations("adminFeedback");
  const { questions, isLoading, createQuestion, updateQuestion, retireQuestion, reorderQuestions } =
    useFeedbackConfig(categoryId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FeedbackQuestion | null>(null);
  const [draftType, setDraftType] = useState<FeedbackQuestionType>("StarRating");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleAdd(type: FeedbackQuestionType) {
    setEditing(null);
    setDraftType(type);
    setDialogOpen(true);
  }

  function handleEdit(question: FeedbackQuestion) {
    setEditing(question);
    setDraftType(question.type);
    setDialogOpen(true);
  }

  async function handleSave(label: string, options?: string) {
    if (editing) {
      await updateQuestion({ id: editing.id, input: { label, options } });
    } else {
      await createQuestion({ categoryId, type: draftType, label, options });
    }
  }

  function handleRetire(question: FeedbackQuestion) {
    if (window.confirm(t("builder.confirmRemove", { label: question.label }))) {
      void retireQuestion(question.id);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(questions, oldIndex, newIndex);
    await reorderQuestions(reordered.map((q) => q.id));
  }

  if (isLoading) return <Skeleton className="h-40 rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("builder.subtitle")}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("builder.addQuestion")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {QUESTION_TYPES.map((type) => (
              <DropdownMenuItem key={type} onClick={() => handleAdd(type)}>
                {t(`questionType.${type}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {questions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          {t("builder.empty")}
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {questions.map((q) => (
                <FeedbackQuestionRow
                  key={q.id}
                  question={q}
                  onEdit={() => handleEdit(q)}
                  onRetire={() => handleRetire(q)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <FeedbackQuestionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        type={draftType}
        isEdit={!!editing}
        initialLabel={editing?.label ?? ""}
        initialOptions={editing?.options}
        onSave={handleSave}
      />
    </div>
  );
}
