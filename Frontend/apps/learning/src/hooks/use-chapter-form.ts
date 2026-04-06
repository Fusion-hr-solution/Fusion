import { useState, useEffect, useCallback } from "react";
import { useApiMutation } from "@repo/api/react";
import { ApiError } from "@repo/api";
import { addChapter, updateChapter, uploadChapterFile } from "@/services/admin-service";
import type { CreateChapterInput, UpdateChapterInput, AdminChapter } from "@/types/admin";

interface UseChapterFormOptions {
  trainingId: string;
  chapter: AdminChapter | null;
  open: boolean;
  onSuccess: () => void;
}

export function useChapterForm({ trainingId, chapter, open, onSuccess }: UseChapterFormOptions) {
  const isEditing = Boolean(chapter);
  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState("Article");
  const [contentUri, setContentUri] = useState("");
  const [orderIndex, setOrderIndex] = useState(0);
  const [textContent, setTextContent] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState<number | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (chapter) {
      setTitle(chapter.title);
      setContentType(chapter.contentType);
      setContentUri(chapter.contentUri ?? "");
      setOrderIndex(chapter.orderIndex);
      setTextContent(chapter.textContent ?? "");
      setVideoUrl(chapter.videoUrl ?? "");
      setEstimatedDuration(chapter.estimatedDurationMinutes ?? "");
    } else {
      setTitle("");
      setContentType("Article");
      setContentUri("");
      setOrderIndex(0);
      setTextContent("");
      setVideoUrl("");
      setEstimatedDuration("");
    }
    setFile(null);
    setIsUploading(false);
    setStep(0);
    setFormError(null);
    setFieldErrors({});
  }, [chapter, open]);

  function extractErrorMessage(err: unknown): string {
    if (err instanceof ApiError) return err.errors[0] ?? err.message;
    if (err instanceof Error) return err.message;
    return "An unexpected error occurred.";
  }

  const { mutateAsync: doAdd, isLoading: adding } = useApiMutation(
    (input: CreateChapterInput) => addChapter(trainingId, input),
    {
      onSuccess: () => { setFormError(null); onSuccess(); },
      onError: (err) => setFormError(extractErrorMessage(err)),
    },
  );

  const { mutateAsync: doUpdate, isLoading: updating } = useApiMutation(
    (input: UpdateChapterInput) => updateChapter(trainingId, chapter!.id, input),
    {
      onSuccess: () => { setFormError(null); onSuccess(); },
      onError: (err) => setFormError(extractErrorMessage(err)),
    },
  );

  const isSaving = adding || updating || isUploading;

  function validateStep0(): boolean {
    const errors: Record<string, string> = {};
    if (!title.trim()) errors.title = "Title is required.";
    else if (title.trim().length < 2) errors.title = "Title must be at least 2 characters.";
    if (orderIndex < 0) errors.orderIndex = "Order index must be 0 or greater.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateStep1(): boolean {
    const errors: Record<string, string> = {};
    const needsFile = contentType === "Pdf" || (contentType === "Video" && !videoUrl);
    if (needsFile && !file && !contentUri)
      errors.file = `Please upload a ${contentType === "Pdf" ? "PDF" : "video"} file.`;
    if (contentType === "Video" && videoUrl && !/^https?:\/\/.+/i.test(videoUrl))
      errors.videoUrl = "Video URL must be a valid URL (https://...).";
    if (estimatedDuration !== "" && estimatedDuration <= 0)
      errors.estimatedDuration = "Duration must be greater than 0.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  const handleNext = useCallback(() => {
    if (validateStep0()) setStep(1);
  }, [title, orderIndex]);

  const handleSubmit = useCallback(async () => {
    if (!validateStep1()) return;
    setFormError(null);

    let uploadedUri = contentUri;
    if (file) {
      try {
        setIsUploading(true);
        uploadedUri = await uploadChapterFile(file);
      } catch (err) {
        setFormError(extractErrorMessage(err));
        return;
      } finally {
        setIsUploading(false);
      }
    }

    const payload = {
      title: title.trim(),
      contentType,
      contentUri: uploadedUri || undefined,
      orderIndex,
      textContent: textContent || undefined,
      videoUrl: (!file && videoUrl) ? videoUrl : undefined,
      estimatedDurationMinutes: estimatedDuration || undefined,
    };
    if (isEditing) await doUpdate(payload);
    else await doAdd(payload);
  }, [title, contentType, contentUri, orderIndex, textContent, videoUrl, estimatedDuration, file, isEditing, doUpdate, doAdd]);

  const canAdvance = title.trim().length > 0;
  const clearFieldError = (field: string) => setFieldErrors((p) => ({ ...p, [field]: "" }));

  return {
    isEditing, step, setStep, formError, fieldErrors, clearFieldError,
    title, setTitle, contentType, setContentType,
    contentUri, setContentUri, orderIndex, setOrderIndex,
    textContent, setTextContent, videoUrl, setVideoUrl,
    estimatedDuration, setEstimatedDuration,
    file, setFile, isUploading,
    isSaving, handleNext, handleSubmit, canAdvance,
  };
}
