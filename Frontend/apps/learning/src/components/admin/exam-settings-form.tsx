"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@repo/ui";
import { ApiError } from "@repo/api";
import type { CreateExamInput, UpdateExamInput } from "@/types/admin";

interface ExamSettingsFormProps {
  mode: "create" | "edit";
  initialValues?: {
    title: string;
    description?: string;
    passingScore: number;
    durationMinutes?: number;
  };
  isLoading?: boolean;
  onSubmit: (input: CreateExamInput | UpdateExamInput) => Promise<void>;
  onCancel: () => void;
}

export function ExamSettingsForm({
  mode,
  initialValues,
  isLoading: externalLoading,
  onSubmit,
  onCancel,
}: ExamSettingsFormProps) {
  const t = useTranslations("adminExam");
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? ""
  );
  const [passingScore, setPassingScore] = useState(
    initialValues?.passingScore ?? 80
  );
  const [durationMinutes, setDurationMinutes] = useState<number | "">(
    initialValues?.durationMinutes ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialValues) {
      setTitle(initialValues.title);
      setDescription(initialValues.description ?? "");
      setPassingScore(initialValues.passingScore);
      setDurationMinutes(initialValues.durationMinutes ?? "");
    }
  }, [initialValues]);

  const canSubmit =
    title.trim().length > 0 &&
    passingScore >= 1 &&
    passingScore <= 100 &&
    !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        passingScore,
        durationMinutes:
          durationMinutes !== "" ? Number(durationMinutes) : undefined,
      });
    } catch (err) {
      if (err instanceof ApiError) setError(err.errors[0] ?? err.message);
      else if (err instanceof Error) setError(err.message);
      else setError(t("settingsForm.unexpectedError"));
    } finally {
      setSaving(false);
    }
  }

  const isSubmitting = saving || externalLoading;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">
          {mode === "create"
            ? t("settingsForm.createTitle")
            : t("settingsForm.editTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-[13px] font-semibold">
              {t("settingsForm.examTitleLabel")}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("settingsForm.examTitlePlaceholder")}
              maxLength={300}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] font-semibold">
              {t("settingsForm.descriptionLabel")}
            </Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("settingsForm.descriptionPlaceholder")}
              maxLength={1000}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[13px] font-semibold">
                {t("settingsForm.passingScoreLabel")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={passingScore}
                onChange={(e) => setPassingScore(Number(e.target.value))}
              />
              <p className="text-[11px] text-muted-foreground">
                {t("settingsForm.passingScoreHint")}
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-semibold">
                {t("settingsForm.durationLabel")}
              </Label>
              <Input
                type="number"
                min={1}
                max={600}
                value={durationMinutes}
                onChange={(e) =>
                  setDurationMinutes(
                    e.target.value === "" ? "" : Number(e.target.value)
                  )
                }
                placeholder={t("settingsForm.durationPlaceholder")}
              />
              <p className="text-[11px] text-muted-foreground">
                {t("settingsForm.durationHint")}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
            >
              {t("settingsForm.cancel")}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!canSubmit || isSubmitting}
              className="ey-bg-dark hover:opacity-90"
            >
              {isSubmitting && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              {mode === "create"
                ? t("settingsForm.createSubmit")
                : t("settingsForm.saveChanges")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
