"use client";

import { useTranslations } from "next-intl";
import {
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui";
import type { TrainingFormDetailsStepProps } from "@/types/admin-props";

export function TrainingFormDetailsStep({
  credits,
  onCreditsChange,
  duration,
  onDurationChange,
  isMandatory,
  onMandatoryChange,
  trainingType,
  scheduledDate,
  onScheduledDateChange,
  fieldErrors = {},
}: TrainingFormDetailsStepProps) {
  const t = useTranslations("adminTrainings");
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">{t("form.details.heading")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="credits">{t("form.details.creditsLabel")}</Label>
            <Input
              id="credits"
              type="number"
              min={0}
              max={1000}
              value={credits}
              onChange={(e) => onCreditsChange(Number(e.target.value))}
              className={fieldErrors.credits ? "border-destructive" : ""}
            />
            {fieldErrors.credits && (
              <p className="text-xs text-destructive">{fieldErrors.credits}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration">{t("form.details.durationLabel")}</Label>
            <Input
              id="duration"
              maxLength={50}
              value={duration}
              onChange={(e) => onDurationChange(e.target.value)}
              placeholder={t("form.details.durationPlaceholder")}
            />
          </div>
        </div>

        {trainingType === "OnSite" && (
          <div className="space-y-2">
            <Label htmlFor="scheduledDate">
              {t("form.details.scheduledDateLabel")}
            </Label>
            <Input
              id="scheduledDate"
              type="datetime-local"
              value={scheduledDate}
              onChange={(e) => onScheduledDateChange(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className={fieldErrors.scheduledDate ? "border-destructive" : ""}
            />
            {fieldErrors.scheduledDate && (
              <p className="text-xs text-destructive">
                {fieldErrors.scheduledDate}
              </p>
            )}
            {!fieldErrors.scheduledDate &&
              scheduledDate &&
              new Date(scheduledDate) <= new Date() && (
                <p className="text-xs text-destructive">
                  {t("form.details.scheduledDateFuture")}
                </p>
              )}
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isMandatory}
            onChange={(e) => onMandatoryChange(e.target.checked)}
            className="rounded border-border"
          />
          {t("form.details.mandatoryLabel")}
        </label>
      </CardContent>
    </Card>
  );
}
