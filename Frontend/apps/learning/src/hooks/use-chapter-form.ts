import { useState, useEffect, useCallback } from "react";
import { useApiMutation } from "@repo/api/react";
import { ApiError } from "@repo/api";
import { addChapter, updateChapter } from "@/services/admin-service";
import type { CreateChapterInput, UpdateChapterInput, AdminChapter } from "@/types/admin";
import type { ChapterLayout } from "@/types";

interface UseChapterFormOptions {
  trainingId: string;
  chapter: AdminChapter | null;
  open: boolean;
  onSuccess: () => void;
}

export function useChapterForm({ trainingId, chapter, open, onSuccess }: UseChapterFormOptions) {
  const isEditing = Boolean(chapter);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [title, setTitle] = useState("");
  const [layout, setLayout] = useState<ChapterLayout>("SingleContent");

  useEffect(() => {
    if (chapter) {
      setTitle(chapter.title);
      setLayout(chapter.layout);
    } else {
      setTitle("");
      setLayout("SingleContent");
    }
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

  const isSaving = adding || updating;

  const handleSubmit = useCallback(async () => {
    const errors: Record<string, string> = {};
    if (!title.trim()) errors.title = "Title is required.";
    else if (title.trim().length < 2) errors.title = "Title must be at least 2 characters.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setFormError(null);
    if (isEditing) {
      await doUpdate({ title: title.trim(), layout });
    } else {
      await doAdd({ title: title.trim(), layout, orderIndex: 0 });
    }
  }, [title, layout, isEditing, doUpdate, doAdd]);

  const clearFieldError = (field: string) => setFieldErrors((p) => ({ ...p, [field]: "" }));

  return {
    isEditing, formError, fieldErrors, clearFieldError,
    title, setTitle, layout, setLayout,
    isSaving, handleSubmit,
  };
}
