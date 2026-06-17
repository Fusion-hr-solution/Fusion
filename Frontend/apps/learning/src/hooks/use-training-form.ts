import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import { ApiError } from "@repo/api";
import {
  getAdminTrainingDetail,
  getAdminCategories,
  createTraining,
  updateTraining,
} from "@/services/admin-service";
import type {
  AdminCategory,
  CreateTrainingInput,
  UpdateTrainingInput,
} from "@/types/admin";
import type { TrainingType } from "@/types";

interface UseTrainingFormOptions {
  trainingId?: string;
  enabled: boolean;
  onCreated?: () => void;
  onUpdated?: () => void;
}

export function useTrainingForm({
  trainingId,
  enabled,
  onCreated,
  onUpdated,
}: UseTrainingFormOptions) {
  const t = useTranslations("adminTrainings");
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
  const [trainingType, setTrainingType] = useState<TrainingType>("ELearning");
  const [scheduledDate, setScheduledDate] = useState("");

  const fetchCategories = useCallback(() => getAdminCategories(), []);

  const fetchExistingTraining = useCallback(
    () => getAdminTrainingDetail(trainingId!),
    [trainingId]
  );

  const { data: categories } = useApiQuery<AdminCategory[]>(fetchCategories, {
    enabled,
  });

  const { data: existing, isLoading: loadingDetail } = useApiQuery(
    fetchExistingTraining,
    { enabled: isEditing && enabled }
  );

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setCategoryId("");
    setBadgeLevel("Bronze");
    setCredits(0);
    setDuration("");
    setIsMandatory(false);
    setTrainingType("ELearning");
    setScheduledDate("");
    setStep(0);
    setFormError(null);
    setFieldErrors({});
  }, []);

  useEffect(() => {
    if (!trainingId) {
      resetForm();
    } else if (existing) {
      setTitle(existing.title);
      setDescription(existing.description);
      setCredits(existing.credits);
      setIsMandatory(existing.isMandatory);
      setBadgeLevel(existing.badgeLevel);
      setDuration(existing.duration);
      setCategoryId(existing.categoryId);
      setTrainingType(existing.trainingType as TrainingType);
      setScheduledDate(existing.scheduledDate ?? "");
      setStep(0);
      setFormError(null);
      setFieldErrors({});
    }
  }, [existing, trainingId, enabled, resetForm]);

  function extractErrorMessage(err: unknown): string {
    if (err instanceof ApiError) return err.errors[0] ?? err.message;
    if (err instanceof Error) return err.message;
    return t("form.errors.unexpected");
  }

  const { mutateAsync: doCreate, isLoading: creating } = useApiMutation(
    (input: CreateTrainingInput) => createTraining(input),
    {
      onSuccess: () => {
        setFormError(null);
        onCreated?.();
      },
      onError: (err) => setFormError(extractErrorMessage(err)),
    }
  );

  const { mutateAsync: doUpdate, isLoading: updating } = useApiMutation(
    (input: UpdateTrainingInput) => updateTraining(trainingId!, input),
    {
      onSuccess: () => {
        setFormError(null);
        onUpdated?.();
      },
      onError: (err) => setFormError(extractErrorMessage(err)),
    }
  );

  const isSaving = creating || updating;

  function validateStep0(): boolean {
    const errors: Record<string, string> = {};
    if (!title.trim()) errors.title = t("form.errors.titleRequired");
    else if (title.trim().length < 2)
      errors.title = t("form.errors.titleMinLength");
    if (!categoryId) errors.categoryId = t("form.errors.categoryRequired");
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateStep1(): boolean {
    const errors: Record<string, string> = {};
    if (credits < 0) errors.credits = t("form.errors.creditsNegative");
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
    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      credits,
      isMandatory,
      badgeLevel,
      duration: duration || undefined,
      categoryId,
      trainingType,
      scheduledDate: scheduledDate || undefined,
    };
    if (isEditing) await doUpdate(payload);
    else await doCreate(payload);
  }

  const canAdvance = (s: number) => {
    if (s === 0) return title.trim().length > 0 && categoryId.length > 0;
    return true;
  };

  const categoryName =
    categories?.find((c) => c.id === categoryId)?.name ??
    t("form.review.emptyValue");

  const clearFieldError = (field: string) =>
    setFieldErrors((p) => ({ ...p, [field]: "" }));

  return {
    isEditing,
    step,
    setStep,
    formError,
    fieldErrors,
    clearFieldError,
    title,
    setTitle,
    description,
    setDescription,
    categoryId,
    setCategoryId,
    badgeLevel,
    setBadgeLevel,
    credits,
    setCredits,
    duration,
    setDuration,
    isMandatory,
    setIsMandatory,
    trainingType,
    setTrainingType,
    scheduledDate,
    setScheduledDate,
    categories: categories ?? [],
    categoryName,
    loadingDetail,
    isSaving,
    handleNext,
    handleSubmit,
    canAdvance,
  };
}
