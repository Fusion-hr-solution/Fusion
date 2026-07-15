"use client";

import { useFormatter, useTranslations } from "next-intl";
import { GraduationCap, Star } from "lucide-react";
import { Card, CardContent, Skeleton } from "@repo/ui";
import { useSessionTrainerFeedback } from "@/hooks/use-session-trainer-feedback";

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 inline-flex items-center gap-1 text-lg font-bold text-foreground">
        <Star className="h-4 w-4 text-[hsl(var(--ey-yellow))]" fill="currentColor" aria-hidden="true" />
        {value}/5
      </p>
    </div>
  );
}

export function TrainerGroupFeedbackCard({ sessionId }: { sessionId: string }) {
  const t = useTranslations("trainerFeedback");
  const format = useFormatter();
  const { feedback, isLoading } = useSessionTrainerFeedback(sessionId);

  if (isLoading) return <Skeleton className="h-32 rounded-xl" />;

  return (
    <Card className="border-border/50">
      <CardContent className="space-y-3 py-5">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground">{t("adminCard.title")}</h3>
        </div>

        {!feedback ? (
          <p className="text-sm text-muted-foreground">{t("adminCard.none")}</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Metric label={t("form.engagement")} value={feedback.groupEngagement} />
              <Metric label={t("form.knowledge")} value={feedback.knowledgeLevel} />
            </div>
            {feedback.comments ? (
              <div>
                <p className="text-xs text-muted-foreground">{t("form.comments")}</p>
                <p className="text-sm text-foreground">{feedback.comments}</p>
              </div>
            ) : null}
            {feedback.prerequisiteSuggestions ? (
              <div>
                <p className="text-xs text-muted-foreground">{t("form.prerequisites")}</p>
                <p className="text-sm text-foreground">{feedback.prerequisiteSuggestions}</p>
              </div>
            ) : null}
            <p className="text-[11px] text-muted-foreground">
              {t("adminCard.by", { name: feedback.trainerName })} ·{" "}
              {format.dateTime(new Date(feedback.submittedAt), { dateStyle: "medium" })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
