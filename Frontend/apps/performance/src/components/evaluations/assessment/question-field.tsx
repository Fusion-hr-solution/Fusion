"use client";

import { Checkbox, Label, Textarea } from "@repo/ds";
import { cn } from "@/lib/utils";
import { RatingControl, type RatingLevel } from "./rating-control";
import { evaluationTerms } from "./evaluation-terms";

export interface QuestionAnswerValue {
  textAnswer: string;
  ratingOrdinal: number | null;
  isNotApplicable: boolean;
  notApplicableReason: string;
}

export const EMPTY_ANSWER: QuestionAnswerValue = {
  textAnswer: "",
  ratingOrdinal: null,
  isNotApplicable: false,
  notApplicableReason: "",
};

/**
 * Controlled input for one frozen template question. Renders by the frozen
 * question type (text or rating on the round's performance scale) with the
 * governed not-applicable path. State lives in the workspace so every keystroke
 * reaches the draft payload.
 */
export function QuestionField({
  questionId,
  prompt,
  type,
  isRequired,
  allowNotApplicable,
  ratingLevels,
  value,
  onChange,
  disabled = false,
}: {
  questionId: string;
  prompt: string;
  type: "Text" | "Rating";
  isRequired: boolean;
  allowNotApplicable: boolean;
  ratingLevels: RatingLevel[];
  value: QuestionAnswerValue;
  onChange: (next: QuestionAnswerValue) => void;
  disabled?: boolean;
}) {
  const naId = `question-na-${questionId}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-medium leading-snug">{prompt}</p>
        {isRequired ? (
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {evaluationTerms.requiredQuestion}
          </span>
        ) : null}
      </div>

      {value.isNotApplicable ? (
        <Textarea
          aria-label={evaluationTerms.notApplicableReason}
          placeholder={evaluationTerms.notApplicableReason}
          value={value.notApplicableReason}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...value, notApplicableReason: event.target.value })
          }
        />
      ) : type === "Rating" ? (
        <RatingControl
          levels={ratingLevels}
          value={value.ratingOrdinal}
          onChange={
            disabled
              ? undefined
              : (ordinal) => onChange({ ...value, ratingOrdinal: ordinal })
          }
          disabled={disabled}
          ariaLabel={prompt}
        />
      ) : (
        <Textarea
          aria-label={prompt}
          value={value.textAnswer}
          disabled={disabled}
          rows={3}
          onChange={(event) =>
            onChange({ ...value, textAnswer: event.target.value })
          }
        />
      )}

      {allowNotApplicable ? (
        <div className={cn("flex items-center gap-2", disabled && "opacity-60")}>
          <Checkbox
            id={naId}
            checked={value.isNotApplicable}
            disabled={disabled}
            onCheckedChange={(checked) =>
              onChange({ ...value, isNotApplicable: checked === true })
            }
          />
          <Label htmlFor={naId} className="text-sm font-normal text-muted-foreground">
            {evaluationTerms.notApplicable}
          </Label>
        </div>
      ) : null}
    </div>
  );
}
