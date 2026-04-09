import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import { ApiError } from "@repo/api";
import {
  getAdminTrainingDetail,
  getAdminCategories,
  updateTraining,
  addChapter,
  updateChapter,
  deleteChapter,
  reorderChapters as reorderChaptersApi,
} from "@/services/admin-service";
import type { AdminCategory, WizardChapter, UpdateTrainingInput } from "@/types/admin";

export function useEditTrainingWizard(trainingId: string) {
  const router = useRouter();
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

  // Step 3 — chapters (title + layout only, content blocks managed separately)
  const [chapters, setChapters] = useState<WizardChapter[]>([]);
  const [deletedServerIds, setDeletedServerIds] = useState<string[]>([]);

  const { data: categories } = useApiQuery<AdminCategory[]>(
    () => getAdminCategories(),
    { enabled: true },
  );

  const { data: existing, isLoading: loadingDetail } = useApiQuery(
    () => getAdminTrainingDetail(trainingId),
    { enabled: true },
  );

  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setDescription(existing.description);
    setCategoryId(existing.categoryId);
    setBadgeLevel(existing.badgeLevel);
    setCredits(existing.credits);
    setDuration(existing.duration);
    setIsMandatory(existing.isMandatory);
    setChapters(
      [...existing.chapters]
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((ch) => ({
          clientId: ch.id,
          title: ch.title,
          layout: ch.layout,
        })),
    );
    setDeletedServerIds([]);
  }, [existing]);

  const nextStep = useCallback(() => setStep((s) => Math.min(s + 1, 4)), []);
  const prevStep = useCallback(() => setStep((s) => Math.max(s - 1, 1)), []);

  const addWizardChapter = useCallback((chapter: Omit<WizardChapter, "clientId">) => {
    setChapters((prev) => [...prev, { ...chapter, clientId: crypto.randomUUID() }]);
  }, []);

  const updateWizardChapter = useCallback((clientId: string, updates: Partial<WizardChapter>) => {
    setChapters((prev) => prev.map((ch) => (ch.clientId === clientId ? { ...ch, ...updates } : ch)));
  }, []);

  const removeWizardChapter = useCallback((clientId: string) => {
    setChapters((prev) => {
      // If the clientId matches a server chapter, mark for deletion
      if (existing?.chapters.some((ec) => ec.id === clientId)) {
        setDeletedServerIds((ids) => [...ids, clientId]);
      }
      return prev.filter((c) => c.clientId !== clientId);
    });
  }, [existing]);

  const reorderWizardChapters = useCallback((reordered: WizardChapter[]) => {
    setChapters(reordered);
  }, []);

  function validateStep1(): boolean {
    if (!title.trim()) { setFormError("Title is required."); return false; }
    if (!categoryId) { setFormError("Please select a category."); return false; }
    setFormError(null);
    return true;
  }

  function validateStep2(): boolean {
    if (credits < 0) { setFormError("Credits cannot be negative."); return false; }
    setFormError(null);
    return true;
  }

  function handleNext() {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setFormError(null);
    nextStep();
  }

  const { mutateAsync: doUpdateTraining } = useApiMutation(
    (input: UpdateTrainingInput) => updateTraining(trainingId, input),
  );

  async function handleSubmit() {
    setFormError(null);
    setIsSubmitting(true);
    try {
      await doUpdateTraining({
        title: title.trim(),
        description: description.trim() || undefined,
        credits,
        isMandatory,
        badgeLevel,
        duration: duration || undefined,
        categoryId,
      });

      for (const id of deletedServerIds) {
        await deleteChapter(trainingId, id);
      }

      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i]!;
        const isExisting = existing?.chapters.some((ec) => ec.id === ch.clientId);
        if (isExisting) {
          await updateChapter(trainingId, ch.clientId, { title: ch.title, layout: ch.layout });
        } else {
          await addChapter(trainingId, { title: ch.title, layout: ch.layout, orderIndex: i });
        }
      }

      const serverIds = chapters
        .filter((c) => existing?.chapters.some((ec) => ec.id === c.clientId))
        .map((c) => c.clientId);
      if (serverIds.length > 1) {
        await reorderChaptersApi(trainingId, serverIds);
      }

      router.push(`/admin/trainings/${trainingId}`);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? (err.errors[0] ?? err.message)
          : err instanceof Error
            ? err.message
            : "An unexpected error occurred.";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const categoryName = categories?.find((c) => c.id === categoryId)?.name ?? "";
  const canAdvanceStep1 = title.trim().length > 0 && categoryId.length > 0;
  const isReady = canAdvanceStep1;

  return {
    step, setStep, formError, setFormError, isSubmitting, loadingDetail,
    title, setTitle, description, setDescription,
    categoryId, setCategoryId, badgeLevel, setBadgeLevel,
    categories: categories ?? [],
    credits, setCredits, duration, setDuration, isMandatory, setIsMandatory,
    chapters,
    addChapter: addWizardChapter,
    updateChapter: updateWizardChapter,
    removeChapter: removeWizardChapter,
    reorderChapters: reorderWizardChapters,
    handleNext, prevStep, handleSubmit,
    canAdvanceStep1, isReady, categoryName,
  };
}
