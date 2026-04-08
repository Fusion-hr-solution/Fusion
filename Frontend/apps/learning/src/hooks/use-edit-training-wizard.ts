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
  uploadChapterFile,
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

  // Step 3 — chapters loaded from server, editable in wizard
  const [chapters, setChapters] = useState<WizardChapter[]>([]);
  // Track which server chapter IDs to delete on submit
  const [deletedServerIds, setDeletedServerIds] = useState<string[]>([]);

  const { data: categories } = useApiQuery<AdminCategory[]>(
    () => getAdminCategories(),
    { enabled: true },
  );

  const { data: existing, isLoading: loadingDetail } = useApiQuery(
    () => getAdminTrainingDetail(trainingId),
    { enabled: true },
  );

  // Populate form when data loads
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
          contentType: ch.contentType,
          textContent: ch.textContent,
          videoUrl: ch.videoUrl,
          estimatedDurationMinutes: ch.estimatedDurationMinutes,
          serverId: ch.id,
          contentUri: ch.contentUri,
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
      const ch = prev.find((c) => c.clientId === clientId);
      if (ch?.serverId) setDeletedServerIds((ids) => [...ids, ch.serverId!]);
      return prev.filter((c) => c.clientId !== clientId);
    });
  }, []);

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
      // 1. Update training metadata
      await doUpdateTraining({
        title: title.trim(),
        description: description.trim() || undefined,
        credits,
        isMandatory,
        badgeLevel,
        duration: duration || undefined,
        categoryId,
      });

      // 2. Delete removed chapters
      for (const id of deletedServerIds) {
        await deleteChapter(trainingId, id);
      }

      // 3. Add/update chapters
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i]!;
        let contentUri = ch.contentUri;
        if (ch.file) contentUri = await uploadChapterFile(ch.file);

        const payload = {
          title: ch.title,
          contentType: ch.contentType,
          orderIndex: i,
          textContent: ch.textContent,
          contentUri,
          videoUrl: ch.videoUrl,
          estimatedDurationMinutes: ch.estimatedDurationMinutes,
        };

        if (ch.serverId) {
          await updateChapter(trainingId, ch.serverId, payload);
        } else {
          await addChapter(trainingId, payload);
        }
      }

      // 4. Reorder chapters (server IDs only)
      const serverIds = chapters.filter((c) => c.serverId).map((c) => c.serverId!);
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
