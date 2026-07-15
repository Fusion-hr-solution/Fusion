"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import type { FeedbackFormProps } from "@/types/component-props";
import { useSubmitFeedback } from "@/hooks/use-submit-feedback";
import { useTrainingFeedbackQuestions } from "@/hooks/use-training-feedback-questions";
import { RatingField } from "./rating-field";
import { CustomQuestionField } from "./custom-question-field";

const TEXTAREA_CLASS =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function FeedbackForm({ pending, open, onOpenChange, onSubmitted }: FeedbackFormProps) {
  const t = useTranslations("feedback");
  const [overall, setOverall] = useState(0);
  const [content, setContent] = useState(0);
  const [relevance, setRelevance] = useState(0);
  const [trainer, setTrainer] = useState(0);
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const { questions } = useTrainingFeedbackQuestions(pending.trainingId, open);

  const isOnSite = pending.trainingType === "OnSite";

  const { submit, isSubmitting } = useSubmitFeedback({
    onSuccess: () => {
      toast.success(t("toast.successTitle"), { description: t("toast.successBody") });
      onOpenChange(false);
      onSubmitted();
    },
    onError: () => toast.error(t("toast.errorTitle"), { description: t("toast.errorBody") }),
  });

  const canSubmit =
    overall >= 1 &&
    content >= 1 &&
    relevance >= 1 &&
    recommend !== null &&
    (!isOnSite || trainer >= 1) &&
    !isSubmitting;

  function handleSubmit() {
    if (recommend === null || !canSubmit) return;
    submit({
      trainingId: pending.trainingId,
      overallRating: overall,
      contentRating: content,
      relevanceRating: relevance,
      trainerRating: isOnSite ? trainer : undefined,
      wouldRecommend: recommend,
      comment: comment.trim() || undefined,
      suggestions: suggestions.trim() || undefined,
      isAnonymous,
      answers: Object.entries(answers)
        .filter(([, v]) => v.trim().length > 0)
        .map(([questionId, value]) => ({ questionId, value: value.trim() })),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("form.title", { title: pending.trainingTitle })}</DialogTitle>
          <DialogDescription>{t("form.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <RatingField label={t("form.overall")} value={overall} onChange={setOverall} />
          <RatingField label={t("form.content")} value={content} onChange={setContent} />
          <RatingField label={t("form.relevance")} value={relevance} onChange={setRelevance} />
          {isOnSite ? (
            <RatingField label={t("form.trainer")} value={trainer} onChange={setTrainer} />
          ) : null}

          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">{t("form.recommend")}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={recommend === true ? "default" : "outline"}
                onClick={() => setRecommend(true)}
              >
                {t("form.recommendYes")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={recommend === false ? "default" : "outline"}
                onClick={() => setRecommend(false)}
              >
                {t("form.recommendNo")}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="feedback-comment" className="text-sm font-medium text-foreground">
              {t("form.comment")}
            </label>
            <textarea
              id="feedback-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("form.commentPlaceholder")}
              rows={3}
              className={TEXTAREA_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="feedback-suggestions" className="text-sm font-medium text-foreground">
              {t("form.suggestions")}
            </label>
            <textarea
              id="feedback-suggestions"
              value={suggestions}
              onChange={(e) => setSuggestions(e.target.value)}
              placeholder={t("form.suggestionsPlaceholder")}
              rows={2}
              className={TEXTAREA_CLASS}
            />
          </div>

          {questions.length > 0 ? (
            <div className="space-y-4 border-t border-border/40 pt-4">
              {questions.map((q) => (
                <CustomQuestionField
                  key={q.id}
                  question={q}
                  value={answers[q.id] ?? ""}
                  onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                />
              ))}
            </div>
          ) : null}

          <div className="flex items-start gap-2">
            <Checkbox
              id="feedback-anonymous"
              checked={isAnonymous}
              onCheckedChange={(c) => setIsAnonymous(c === true)}
            />
            <div className="space-y-0.5">
              <label htmlFor="feedback-anonymous" className="text-sm font-medium text-foreground">
                {t("form.anonymous")}
              </label>
              <p className="text-xs text-muted-foreground">{t("form.anonymousHint")}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {t("form.cancel")}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? t("form.submitting") : t("form.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
