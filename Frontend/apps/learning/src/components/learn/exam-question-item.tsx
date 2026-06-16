"use client";

import { Card, CardContent } from "@repo/ui";
import { Circle, CheckCircle2 } from "lucide-react";
import type { ExamQuestionItemProps } from "@/types/component-props";

export function ExamQuestionItem({
  question,
  index,
  selectedOptionIds,
  onSetAnswer,
}: ExamQuestionItemProps) {
  const isMulti = question.type === "MultipleChoice";

  function handleSelect(optionId: string) {
    if (isMulti) {
      const current = new Set(selectedOptionIds);
      if (current.has(optionId)) current.delete(optionId);
      else current.add(optionId);
      onSetAnswer(question.id, [...current]);
    } else {
      onSetAnswer(question.id, [optionId]);
    }
  }

  return (
    <Card
      className="ey-animate-fade-up border-border/60"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <CardContent className="p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 id={`exam-q-${question.id}`} className="text-sm font-semibold text-foreground leading-relaxed">
            <span className="text-muted-foreground mr-2">Q{index + 1}.</span>
            {question.questionText}
          </h3>
          <span className="shrink-0 text-xs text-muted-foreground">
            {question.points} {question.points === 1 ? "pt" : "pts"}
          </span>
        </div>
        {isMulti && (
          <p className="mb-3 text-xs text-muted-foreground">Select all that apply</p>
        )}
        <div
          className="space-y-2"
          role={isMulti ? "group" : "radiogroup"}
          aria-labelledby={`exam-q-${question.id}`}
        >
          {question.options.map((option) => {
            const selected = selectedOptionIds.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                role={isMulti ? "checkbox" : "radio"}
                aria-checked={selected}
                onClick={() => handleSelect(option.id)}
                className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-all ${
                  selected
                    ? "border-[hsl(var(--ey-blue-500))] bg-[hsl(var(--ey-blue-500))]/5 text-foreground"
                    : "border-border/60 bg-white text-foreground hover:border-border hover:bg-muted/30"
                }`}
              >
                {selected ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[hsl(var(--ey-blue-500))]" aria-hidden="true" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" aria-hidden="true" />
                )}
                {option.optionText}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
