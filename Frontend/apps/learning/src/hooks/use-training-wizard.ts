import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import { ApiError } from "@repo/api";
import { getAdminCategories, createTraining } from "@/services/admin-service";
import type {
  AdminCategory,
  CreateTrainingInput,
  WizardChapter,
} from "@/types/admin";
import type { TrainingType } from "@/types";

interface UseTrainingWizardOptions {
  mode?: "create";
}

export function useTrainingWizard(_options?: UseTrainingWizardOptions) {
  const router = useRouter();
  const t = useTranslations("adminWizard");
  const [step, setStep] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [badgeLevel, setBadgeLevel] = useState("Bronze");

  // Step 2
  const [credits, setCredits] = useState(0);
  const [duration, setDuration] = useState("");
  const [isMandatory, setIsMandatory] = useState(false);
  const [trainingType, setTrainingType] = useState<TrainingType>("ELearning");
  const [scheduledDate, setScheduledDate] = useState("");

  // Step 3
  const [chapters, setChapters] = useState<WizardChapter[]>([]);

  const fetchCategories = useCallback(() => getAdminCategories(), []);

  const { data: categories } = useApiQuery<AdminCategory[]>(fetchCategories, {
    enabled: true,
  });

  const maxStep = trainingType === "OnSite" ? 3 : 4;

  const nextStep = useCallback(
    () => setStep((s) => Math.min(s + 1, maxStep)),
    [maxStep]
  );
  const prevStep = useCallback(() => setStep((s) => Math.max(s - 1, 1)), []);

  const addChapter = useCallback((chapter: Omit<WizardChapter, "clientId">) => {
    setChapters((prev) => [
      ...prev,
      { ...chapter, clientId: crypto.randomUUID() },
    ]);
  }, []);

  const updateChapter = useCallback(
    (clientId: string, updates: Partial<WizardChapter>) => {
      setChapters((prev) =>
        prev.map((ch) =>
          ch.clientId === clientId ? { ...ch, ...updates } : ch
        )
      );
    },
    []
  );

  const removeChapter = useCallback((clientId: string) => {
    setChapters((prev) => prev.filter((ch) => ch.clientId !== clientId));
  }, []);

  const reorderChapters = useCallback((reordered: WizardChapter[]) => {
    setChapters(reordered);
  }, []);

  function validateStep1(): boolean {
    if (!title.trim()) {
      setFormError(t("errors.titleRequired"));
      return false;
    }
    if (!categoryId) {
      setFormError(t("errors.categoryRequired"));
      return false;
    }
    setFormError(null);
    return true;
  }

  function validateStep2(): boolean {
    if (credits < 0) {
      setFormError(t("errors.creditsNegative"));
      return false;
    }
    if (
      trainingType === "OnSite" &&
      scheduledDate &&
      new Date(scheduledDate) <= new Date()
    ) {
      setFormError(t("errors.scheduledDateFuture"));
      return false;
    }
    setFormError(null);
    return true;
  }

  function handleNext() {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setFormError(null);
    nextStep();
  }

  const { mutateAsync: doCreate } = useApiMutation(
    (input: CreateTrainingInput) => createTraining(input)
  );

  async function handleSubmit() {
    setFormError(null);
    setIsSubmitting(true);
    try {
      const resolvedChapters = chapters.map((ch, index) => ({
        title: ch.title,
        layout: ch.layout,
        orderIndex: index,
      }));

      await doCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        credits,
        isMandatory,
        badgeLevel,
        duration: duration || undefined,
        categoryId,
        trainingType,
        scheduledDate: scheduledDate || undefined,
        chapters: resolvedChapters,
      });

      router.push("/admin/trainings");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? (err.errors[0] ?? err.message)
          : err instanceof Error
            ? err.message
            : t("errors.unexpected");
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const categoryName = categories?.find((c) => c.id === categoryId)?.name ?? "";
  const canAdvanceStep1 = title.trim().length > 0 && categoryId.length > 0;
  const isReady =
    canAdvanceStep1 && (trainingType === "OnSite" || chapters.length > 0);

  return {
    mode: "create" as const,
    step,
    setStep,
    formError,
    setFormError,
    isSubmitting,
    loadingDetail: false,
    title,
    setTitle,
    description,
    setDescription,
    categoryId,
    setCategoryId,
    badgeLevel,
    setBadgeLevel,
    categories: categories ?? [],
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
    chapters,
    addChapter,
    updateChapter,
    removeChapter,
    reorderChapters,
    handleNext,
    prevStep,
    handleSubmit,
    canAdvanceStep1,
    isReady,
    categoryName,
  };
}
