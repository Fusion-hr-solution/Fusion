"use client";

import {
  ArrowLeft,
  ArrowRight,
  Save,
  Loader2,
  FileText,
  Settings,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
} from "@repo/ui";
import type { TrainingFormDialogProps } from "@/types/admin-props";
import { useTrainingForm } from "@/hooks/use-training-form";
import { StepIndicator } from "./step-indicator";
import { TrainingFormBasicStep } from "./training-form-basic-step";
import { TrainingFormDetailsStep } from "./training-form-details-step";
import { TrainingFormReviewStep } from "./training-form-review-step";

const STEPS = [
  { label: "Basic Info", icon: <FileText className="h-4 w-4" /> },
  { label: "Details", icon: <Settings className="h-4 w-4" /> },
  { label: "Review", icon: <CheckCircle2 className="h-4 w-4" /> },
];

export function TrainingFormDialog({
  trainingId,
  open,
  onOpenChange,
  onSaved,
}: TrainingFormDialogProps) {
  const form = useTrainingForm({
    trainingId,
    enabled: open,
    onCreated: () => { onOpenChange(false); onSaved(); },
    onUpdated: () => { onOpenChange(false); onSaved(); },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{form.isEditing ? "Edit Training" : "Create Training"}</DialogTitle>
        </DialogHeader>

        {form.isEditing && form.loadingDetail ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            Loading training...
          </div>
        ) : (
          <>
            {form.formError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{form.formError}</span>
              </div>
            )}

            <div className="py-2">
              <StepIndicator steps={STEPS} currentStep={form.step} />
            </div>

            <div className="mt-2">
              {form.step === 0 && (
                <TrainingFormBasicStep
                  title={form.title} onTitleChange={(v) => { form.setTitle(v); form.clearFieldError("title"); }}
                  description={form.description} onDescriptionChange={form.setDescription}
                  categoryId={form.categoryId} onCategoryChange={(v) => { form.setCategoryId(v); form.clearFieldError("categoryId"); }}
                  categories={form.categories}
                  badgeLevel={form.badgeLevel} onBadgeLevelChange={form.setBadgeLevel}
                  fieldErrors={form.fieldErrors}
                />
              )}

              {form.step === 1 && (
                <TrainingFormDetailsStep
                  credits={form.credits} onCreditsChange={(v) => { form.setCredits(v); form.clearFieldError("credits"); }}
                  duration={form.duration} onDurationChange={form.setDuration}
                  isMandatory={form.isMandatory} onMandatoryChange={form.setIsMandatory}
                  fieldErrors={form.fieldErrors}
                />
              )}

              {form.step === 2 && (
                <TrainingFormReviewStep
                  title={form.title} description={form.description} categoryName={form.categoryName}
                  badgeLevel={form.badgeLevel} credits={form.credits} duration={form.duration} isMandatory={form.isMandatory}
                />
              )}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <Button type="button" variant="outline" onClick={() => { if (form.step === 0) onOpenChange(false); else form.setStep(form.step - 1); }}>
                {form.step === 0 ? "Cancel" : <><ArrowLeft className="mr-1 h-4 w-4" /> Previous</>}
              </Button>

              {form.step < STEPS.length - 1 ? (
                <Button type="button" disabled={!form.canAdvance(form.step)} onClick={form.handleNext} className="ey-bg-dark hover:opacity-90">
                  Next <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" disabled={form.isSaving} onClick={form.handleSubmit} className="ey-bg-dark hover:opacity-90">
                  {form.isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {form.isEditing ? "Update Training" : "Create Training"}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
