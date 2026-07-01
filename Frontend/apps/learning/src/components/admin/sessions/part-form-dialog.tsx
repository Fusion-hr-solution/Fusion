"use client";

import { useState, useEffect } from "react";
import { Clock, FileText, CheckCircle2, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
} from "@repo/ui";
import { useTranslations } from "next-intl";
import { useApiMutation } from "@repo/api/react";
import { addPart, updatePart } from "@/services/admin-sessions-service";
import type { AdminTrainingPart, CreatePartInput } from "@/types/admin";

interface PartFormDialogProps {
  trainingId: string;
  part: AdminTrainingPart | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function PartFormDialog({
  trainingId,
  part,
  open,
  onOpenChange,
  onSaved,
}: PartFormDialogProps) {
  const t = useTranslations("adminSessions");
  const tCommon = useTranslations("common");
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationHours, setDurationHours] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!part;
  const isPartCompleted =
    isEditing &&
    part.sessions.length > 0 &&
    part.sessions.every(
      (s) => s.status === "Completed" || new Date(s.endUtc) < new Date()
    );
  const isLocked = isEditing && (isPartCompleted || part.isLocked);
  const totalSteps = isEditing ? 1 : 2; // Edit mode skips review

  useEffect(() => {
    if (open) {
      setStep(0);
      setTitle(part?.title ?? "");
      setDescription(part?.description ?? "");
      setDurationHours(String(part?.durationHours ?? 1));
      setError(null);
    }
  }, [open, part]);

  const { mutateAsync: doAdd, isLoading: addingPending } = useApiMutation(
    (input: CreatePartInput) => addPart(trainingId, input),
    {
      onSuccess: () => {
        onSaved();
        onOpenChange(false);
      },
    }
  );

  const { mutateAsync: doUpdate, isLoading: updatingPending } = useApiMutation(
    (input: CreatePartInput) => updatePart(trainingId, part!.id, input),
    {
      onSuccess: () => {
        onSaved();
        onOpenChange(false);
      },
    }
  );

  function validateStep0(): boolean {
    if (!title.trim()) {
      setError(t("partDialog.titleRequired"));
      return false;
    }
    const hours = Number(durationHours);
    if (!Number.isFinite(hours) || hours < 0) {
      setError(t("partDialog.durationInvalid"));
      return false;
    }
    setError(null);
    return true;
  }

  function handleNext() {
    if (step === 0 && !validateStep0()) return;
    setStep(step + 1);
  }

  async function handleSubmit() {
    setError(null);
    if (!validateStep0()) return;

    const input: CreatePartInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      durationHours: Number(durationHours),
    };
    try {
      if (isEditing) await doUpdate(input);
      else await doAdd(input);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("partDialog.saveFailed"));
    }
  }

  const isLoading = addingPending || updatingPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("partDialog.editTitle") : t("partDialog.addTitle")}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator (for create mode only) */}
        {!isEditing && (
          <div className="flex items-center justify-center gap-0 py-2">
            {[
              { label: t("partDialog.stepDetails"), icon: FileText },
              { label: t("partDialog.stepReview"), icon: CheckCircle2 },
            ].map((s, index) => {
              const isCompleted = index < step;
              const isCurrent = index === step;
              const Icon = s.icon;
              return (
                <div key={s.label} className="flex items-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                        isCompleted
                          ? "border-[hsl(var(--ey-green-500))] bg-[hsl(var(--ey-green-500))] text-white"
                          : isCurrent
                            ? "border-[hsl(var(--ey-black))] bg-[hsl(var(--ey-black))] text-white shadow-md"
                            : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium ${isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {index < 1 && (
                    <div
                      className={`mx-4 mb-5 h-0.5 w-16 rounded-full transition-colors duration-300 ${index < step ? "bg-[hsl(var(--ey-green-500))]" : "bg-muted"}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Step 0: Form fields */}
        {step === 0 && (
          <div className="space-y-4 pt-2">
            {/* Lock banner for completed/locked parts */}
            {isLocked && (
              <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--ey-orange-500))]/30 bg-[hsl(var(--ey-orange-500))]/10 px-4 py-3">
                <Lock className="h-4 w-4 text-[hsl(var(--ey-orange-500))] shrink-0" />
                <p className="text-xs text-foreground">
                  {isPartCompleted
                    ? t("partDialog.lockedCompleted")
                    : t("partDialog.lockedGeneric")}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="partTitle" className="text-sm font-medium">
                {t("partDialog.titleLabel")}
              </Label>
              <Input
                id="partTitle"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setError(null);
                }}
                maxLength={300}
                placeholder={t("partDialog.titlePlaceholder")}
                className="h-10"
                disabled={isLocked}
              />
              <p className="text-xs text-muted-foreground">
                {t("partDialog.titleHint")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="partDescription" className="text-sm font-medium">
                {t("partDialog.descriptionLabel")}
              </Label>
              <Input
                id="partDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                placeholder={t("partDialog.descriptionPlaceholder")}
                className="h-10"
                disabled={isLocked}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partDuration" className="text-sm font-medium">
                {t("partDialog.durationLabel")}
              </Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="partDuration"
                  type="number"
                  min={0}
                  step={0.5}
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                  className="h-10 pl-9"
                  disabled={isLocked}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("partDialog.durationHint")}
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Review (create mode) */}
        {step === 1 && !isEditing && (
          <div className="space-y-3 pt-2">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                {t("partDialog.reviewTitle")}
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("partDialog.reviewTitleField")}
                  </p>
                  <p className="font-medium">{title || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("partDialog.reviewDuration")}
                  </p>
                  <p className="font-medium">
                    {t("partDialog.reviewDurationValue", {
                      hours: durationHours,
                    })}
                  </p>
                </div>
                {description && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">
                      {t("partDialog.reviewDescription")}
                    </p>
                    <p className="font-medium">{description}</p>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("partDialog.reviewNote")}
            </p>
          </div>
        )}

        {error && <p className="text-sm text-destructive mt-2">{error}</p>}

        <DialogFooter className="gap-2 pt-2">
          {step > 0 && !isEditing && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              disabled={isLoading}
              className="mr-auto"
            >
              {tCommon("actions.back")}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {tCommon("actions.cancel")}
          </Button>
          {isEditing || step === totalSteps - 1 ? (
            <Button
              onClick={handleSubmit}
              disabled={isLoading || isLocked}
              className="ey-bg-dark hover:opacity-90"
            >
              {isLoading
                ? tCommon("actions.saving")
                : isEditing
                  ? t("partDialog.update")
                  : t("partDialog.createPart")}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              className="ey-bg-dark hover:opacity-90"
            >
              {tCommon("actions.next")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
