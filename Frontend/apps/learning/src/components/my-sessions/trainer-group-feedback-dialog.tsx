"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import { ApiError } from "@repo/api";
import { useApiMutation } from "@repo/api/react";
import { submitTrainerGroupFeedback } from "@/services/feedback-service";
import { StarRating } from "@/components/feedback";
import type { TrainerSession } from "@/types";

interface TrainerGroupFeedbackDialogProps {
  session: TrainerSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void;
}

const TEXTAREA_CLASS =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function TrainerGroupFeedbackDialog({
  session,
  open,
  onOpenChange,
  onSubmitted,
}: TrainerGroupFeedbackDialogProps) {
  const t = useTranslations("trainerFeedback");
  const [engagement, setEngagement] = useState(0);
  const [knowledge, setKnowledge] = useState(0);
  const [comments, setComments] = useState("");
  const [prerequisites, setPrerequisites] = useState("");

  useEffect(() => {
    if (open) {
      setEngagement(0);
      setKnowledge(0);
      setComments("");
      setPrerequisites("");
    }
  }, [open]);

  const { mutate, isLoading } = useApiMutation(
    () =>
      submitTrainerGroupFeedback({
        sessionId: session.sessionId,
        groupEngagement: engagement,
        knowledgeLevel: knowledge,
        comments: comments.trim() || undefined,
        prerequisiteSuggestions: prerequisites.trim() || undefined,
      }),
    {
      onSuccess: () => {
        toast.success(t("toast.successTitle"), { description: t("toast.successBody") });
        onOpenChange(false);
        onSubmitted();
      },
      onError: (err) => {
        const description =
          err instanceof ApiError && err.errors.length > 0
            ? err.errors.join(". ")
            : t("toast.errorBody");
        toast.error(t("toast.errorTitle"), { description });
      },
    },
  );

  const canSubmit = engagement >= 1 && knowledge >= 1 && !isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("form.title")}</DialogTitle>
          <DialogDescription>
            {session.trainingTitle} — {session.partTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">{t("form.engagement")}</p>
            <StarRating label={t("form.engagement")} value={engagement} onChange={setEngagement} />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">{t("form.knowledge")}</p>
            <StarRating label={t("form.knowledge")} value={knowledge} onChange={setKnowledge} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="tgf-comments" className="text-sm font-medium text-foreground">
              {t("form.comments")}
            </label>
            <textarea
              id="tgf-comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              className={TEXTAREA_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="tgf-prereq" className="text-sm font-medium text-foreground">
              {t("form.prerequisites")}
            </label>
            <textarea
              id="tgf-prereq"
              value={prerequisites}
              onChange={(e) => setPrerequisites(e.target.value)}
              rows={2}
              placeholder={t("form.prerequisitesPlaceholder")}
              className={TEXTAREA_CLASS}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {t("form.cancel")}
          </Button>
          <Button type="button" onClick={() => mutate()} disabled={!canSubmit}>
            {isLoading ? t("form.submitting") : t("form.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
