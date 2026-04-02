"use client";

import { useState, useEffect } from "react";
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
import { useApiQuery, useApiMutation } from "@repo/api/react";
import { ApiError } from "@repo/api";
import {
  getAdminTrainingDetail,
  getAdminCategories,
  createTraining,
  updateTraining,
} from "@/services/admin-service";
import type { AdminCategory, CreateTrainingInput, UpdateTrainingInput } from "@/types/admin";
import type { TrainingFormDialogProps } from "@/types/admin-props";
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
  const isEditing = Boolean(trainingId);
  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [badgeLevel, setBadgeLevel] = useState("Bronze");
  const [credits, setCredits] = useState(0);
  const [duration, setDuration] = useState("");
  const [isMandatory, setIsMandatory] = useState(false);

  const { data: categories } = useApiQuery<AdminCategory[]>(
    () => getAdminCategories(),
    { enabled: open },
  );

  const { data: existing, isLoading: loadingDetail } = useApiQuery(
    () => getAdminTrainingDetail(trainingId!),
    { enabled: isEditing && open },
  );

  useEffect(() => {
    if (!trainingId) {
      setTitle("");
      setDescription("");
      setCategoryId("");
      setBadgeLevel("Bronze");
      setCredits(0);
      setDuration("");
      setIsMandatory(false);
    } else if (existing) {
      setTitle(existing.title);
      setDescription(existing.description);
      setCredits(existing.credits);
      setIsMandatory(existing.isMandatory);
      setBadgeLevel(existing.badgeLevel);
      setDuration(existing.duration);
      setCategoryId(existing.categoryId);
    }
    setStep(0);
    setFormError(null);
    setFieldErrors({});
  }, [existing, trainingId, open]);

  function extractErrorMessage(err: unknown): string {
    if (err instanceof ApiError) return err.errors[0] ?? err.message;
    if (err instanceof Error) return err.message;
    return "An unexpected error occurred.";
  }

  const { mutateAsync: doCreate, isLoading: creating } = useApiMutation(
    (input: CreateTrainingInput) => createTraining(input),
    {
      onSuccess: () => { setFormError(null); onOpenChange(false); onSaved(); },
      onError: (err) => setFormError(extractErrorMessage(err)),
    },
  );

  const { mutateAsync: doUpdate, isLoading: updating } = useApiMutation(
    (input: UpdateTrainingInput) => updateTraining(trainingId!, input),
    {
      onSuccess: () => { setFormError(null); onOpenChange(false); onSaved(); },
      onError: (err) => setFormError(extractErrorMessage(err)),
    },
  );

  const isSaving = creating || updating;

  function validateStep0(): boolean {
    const errors: Record<string, string> = {};
    if (!title.trim()) errors.title = "Title is required.";
    else if (title.trim().length < 2) errors.title = "Title must be at least 2 characters.";
    if (!categoryId) errors.categoryId = "Please select a category.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateStep1(): boolean {
    const errors: Record<string, string> = {};
    if (credits < 0) errors.credits = "Credits cannot be negative.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleNext() {
    if (step === 0 && !validateStep0()) return;
    if (step === 1 && !validateStep1()) return;
    setFieldErrors({});
    setStep(step + 1);
  }

  async function handleSubmit() {
    setFormError(null);
    const payload = { title: title.trim(), description: description.trim(), credits, isMandatory, badgeLevel, duration, categoryId };
    if (isEditing) await doUpdate(payload);
    else await doCreate(payload);
  }

  const canAdvance = (s: number) => {
    if (s === 0) return title.trim().length > 0 && categoryId.length > 0;
    return true;
  };

  const categoryName = categories?.find((c) => c.id === categoryId)?.name ?? "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Training" : "Create Training"}</DialogTitle>
        </DialogHeader>

        {isEditing && loadingDetail ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            Loading training...
          </div>
        ) : (
          <>
            {formError && (
              <div className="flex items-start gap-2 rounded-md border border-[hsl(var(--ey-red-500))]/30 bg-[hsl(var(--ey-red-500))]/5 p-3 text-sm text-[hsl(var(--ey-red-500))]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="py-2">
              <StepIndicator steps={STEPS} currentStep={step} />
            </div>

            <div className="mt-2">
              {step === 0 && (
                <TrainingFormBasicStep
                  title={title} onTitleChange={(v) => { setTitle(v); setFieldErrors((p) => ({ ...p, title: "" })); }}
                  description={description} onDescriptionChange={setDescription}
                  categoryId={categoryId} onCategoryChange={(v) => { setCategoryId(v); setFieldErrors((p) => ({ ...p, categoryId: "" })); }}
                  categories={categories ?? []}
                  badgeLevel={badgeLevel} onBadgeLevelChange={setBadgeLevel}
                  fieldErrors={fieldErrors}
                />
              )}

              {step === 1 && (
                <TrainingFormDetailsStep
                  credits={credits} onCreditsChange={(v) => { setCredits(v); setFieldErrors((p) => ({ ...p, credits: "" })); }}
                  duration={duration} onDurationChange={setDuration}
                  isMandatory={isMandatory} onMandatoryChange={setIsMandatory}
                  fieldErrors={fieldErrors}
                />
              )}

              {step === 2 && (
                <TrainingFormReviewStep
                  title={title} description={description} categoryName={categoryName}
                  badgeLevel={badgeLevel} credits={credits} duration={duration} isMandatory={isMandatory}
                />
              )}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <Button type="button" variant="outline" onClick={() => { setFieldErrors({}); if (step === 0) onOpenChange(false); else setStep(step - 1); }}>
                {step === 0 ? "Cancel" : <><ArrowLeft className="mr-1 h-4 w-4" /> Previous</>}
              </Button>

              {step < STEPS.length - 1 ? (
                <Button type="button" disabled={!canAdvance(step)} onClick={handleNext} className="ey-bg-dark hover:opacity-90">
                  Next <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" disabled={isSaving} onClick={handleSubmit} className="ey-bg-dark hover:opacity-90">
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {isEditing ? "Update Training" : "Create Training"}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
