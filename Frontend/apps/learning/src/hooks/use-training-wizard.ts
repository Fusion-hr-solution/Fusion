import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import { ApiError } from "@repo/api";
import { getAdminCategories, createTraining, uploadChapterFile } from "@/services/admin-service";
import type { AdminCategory, CreateTrainingInput, WizardChapter } from "@/types/admin";

export function useTrainingWizard() {
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

  // Step 3
  const [chapters, setChapters] = useState<WizardChapter[]>([]);

  const { data: categories } = useApiQuery<AdminCategory[]>(
    () => getAdminCategories(),
    { enabled: true },
  );

  const nextStep = useCallback(() => setStep((s) => Math.min(s + 1, 4)), []);
  const prevStep = useCallback(() => setStep((s) => Math.max(s - 1, 1)), []);

  const addChapter = useCallback((chapter: Omit<WizardChapter, "clientId">) => {
    setChapters((prev) => [...prev, { ...chapter, clientId: crypto.randomUUID() }]);
  }, []);

  const updateChapter = useCallback((clientId: string, updates: Partial<WizardChapter>) => {
    setChapters((prev) => prev.map((ch) => (ch.clientId === clientId ? { ...ch, ...updates } : ch)));
  }, []);

  const removeChapter = useCallback((clientId: string) => {
    setChapters((prev) => prev.filter((ch) => ch.clientId !== clientId));
  }, []);

  const reorderChapters = useCallback((reordered: WizardChapter[]) => {
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

  const { mutateAsync: doCreate } = useApiMutation(
    (input: CreateTrainingInput) => createTraining(input),
  );

  async function handleSubmit() {
    setFormError(null);
    setIsSubmitting(true);
    try {
      const resolvedChapters = await Promise.all(
        chapters.map(async (ch, index) => {
          let contentUri: string | undefined;
          if (ch.file) contentUri = await uploadChapterFile(ch.file);
          return {
            title: ch.title,
            contentType: ch.contentType,
            orderIndex: index,
            textContent: ch.textContent,
            contentUri,
            videoUrl: ch.videoUrl,
            estimatedDurationMinutes: ch.estimatedDurationMinutes,
          };
        }),
      );

      await doCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        credits,
        isMandatory,
        badgeLevel,
        duration: duration || undefined,
        categoryId,
        chapters: resolvedChapters,
      });

      router.push("/admin/trainings");
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
  const isReady = canAdvanceStep1 && chapters.length > 0;

  return {
    step, setStep, formError, setFormError, isSubmitting,
    title, setTitle, description, setDescription,
    categoryId, setCategoryId, badgeLevel, setBadgeLevel,
    categories: categories ?? [],
    credits, setCredits, duration, setDuration, isMandatory, setIsMandatory,
    chapters, addChapter, updateChapter, removeChapter, reorderChapters,
    handleNext, prevStep, handleSubmit,
    canAdvanceStep1, isReady, categoryName,
  };
}
