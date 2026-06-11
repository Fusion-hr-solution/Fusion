import { CheckCircle2 } from "lucide-react";
import { useTranslations, useFormatter } from "next-intl";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import type { TrainingFormReviewStepProps } from "@/types/admin-props";

export function TrainingFormReviewStep({
  title,
  description,
  categoryName,
  badgeLevel,
  credits,
  duration,
  isMandatory,
  trainingType,
  scheduledDate,
}: TrainingFormReviewStepProps) {
  const t = useTranslations("adminTrainings");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const emptyValue = t("form.review.emptyValue");
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="h-4 w-4 text-[hsl(var(--ey-green-500))]" />
          {t("form.review.heading")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted/50 p-4 space-y-3 text-sm">
          <Row
            label={t("form.review.trainingType")}
            value={
              trainingType === "OnSite"
                ? t("detail.onSite")
                : t("detail.eLearning")
            }
          />
          <Row label={t("form.review.title")} value={title} />
          <Row
            label={t("form.review.description")}
            value={description || emptyValue}
          />
          <Row label={t("form.review.category")} value={categoryName} />
          <Row
            label={t("form.review.badgeLevel")}
            value={tCommon(`badgeLevel.${badgeLevel.toLowerCase()}`)}
          />
          <Row
            label={t("form.review.credits")}
            value={format.number(credits)}
          />
          <Row
            label={t("form.review.duration")}
            value={duration || emptyValue}
          />
          {trainingType === "OnSite" && scheduledDate && (
            <Row
              label={t("form.review.scheduledDate")}
              value={format.dateTime(new Date(scheduledDate), {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            />
          )}
          <Row
            label={t("form.review.mandatory")}
            value={
              isMandatory ? (
                <Badge
                  variant="outline"
                  className="text-[10px] border-destructive/30 text-destructive"
                >
                  {t("form.review.yes")}
                </Badge>
              ) : (
                t("form.review.no")
              )
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
