"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MessageSquare } from "lucide-react";
import { Button, Card, CardContent } from "@repo/ui";
import { usePendingFeedback } from "@/hooks/use-pending-feedback";
import { FeedbackForm } from "./feedback-form";

/**
 * Derived in-app feedback prompt: surfaces completed trainings the learner hasn't rated yet.
 * Self-fetching; renders nothing when there is no pending feedback (no notification subsystem).
 */
export function FeedbackPrompt() {
  const t = useTranslations("feedback");
  const { pending, refetch } = usePendingFeedback();
  const [open, setOpen] = useState(false);

  const latest = pending[0];
  if (!latest) return null;

  return (
    <>
      <Card className="border-[hsl(var(--ey-yellow))]/40 bg-[hsl(var(--ey-yellow))]/5">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start gap-3">
            <span
              className="rounded-lg bg-[hsl(var(--ey-yellow))]/15 p-2 text-foreground"
              aria-hidden="true"
            >
              <MessageSquare className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">{t("prompt.title")}</p>
              <p className="text-xs text-muted-foreground">
                {pending.length === 1
                  ? t("prompt.one")
                  : t("prompt.many", { count: pending.length })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("prompt.latest", { title: latest.trainingTitle })}
              </p>
            </div>
          </div>
          <Button size="sm" className="w-full" onClick={() => setOpen(true)}>
            {t("prompt.cta")}
          </Button>
        </CardContent>
      </Card>
      <FeedbackForm pending={latest} open={open} onOpenChange={setOpen} onSubmitted={refetch} />
    </>
  );
}
