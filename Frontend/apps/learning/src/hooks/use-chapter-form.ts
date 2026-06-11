import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useApiMutation } from "@repo/api/react";
import { ApiError } from "@repo/api";
import {
  addChapter,
  updateChapter,
  uploadChapterFile,
} from "@/services/admin-service";
import type {
  CreateChapterInput,
  UpdateChapterInput,
  AdminChapter,
  ArticleTemplate,
} from "@/types/admin";

interface UseChapterFormOptions {
  trainingId: string;
  chapter: AdminChapter | null;
  open: boolean;
  onSuccess: () => void;
}

export function useChapterForm({
  trainingId,
  chapter,
  open,
  onSuccess,
}: UseChapterFormOptions) {
  const t = useTranslations("adminChapters");
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
  const [selectedTemplate, setSelectedTemplate] =
    useState<ArticleTemplate | null>(null);
  const [sectionValues, setSectionValues] = useState<Record<string, string>>(
    {}
  );
  const [initialTemplateName, setInitialTemplateName] = useState<
    string | undefined
  >(undefined);

  useEffect(() => {
    if (chapter) {
      setTitle(chapter.title);
      setContentType(chapter.contentType);
      setContentUri(chapter.contentUri ?? "");
      setOrderIndex(chapter.orderIndex);
      setTextContent(chapter.textContent ?? "");
      setVideoUrl(chapter.videoUrl ?? "");
      setEstimatedDuration(chapter.estimatedDurationMinutes ?? "");
      // Restore article template sections from stored JSON
      if (chapter.contentType === "Article" && chapter.textContent) {
        try {
          const parsed = JSON.parse(chapter.textContent);
          if (parsed.templateName) setInitialTemplateName(parsed.templateName);
          // Sections stored as array of { label, content } — we'll re-populate
          // sectionValues by label once the template loads and we know the section IDs.
          // For now, store the raw parsed sections for label-based restoration.
          if (Array.isArray(parsed.sections)) {
            setSectionValues(
              Object.fromEntries(
                parsed.sections.map((s: { label: string; content: string }) => [
                  s.label,
                  s.content,
                ])
              )
            );
          } else if (parsed.sections) {
            // Legacy format: Record<sectionId, content>
            setSectionValues(parsed.sections);
          } else {
            setSectionValues({});
          }
        } catch {
          setSectionValues({});
          setInitialTemplateName(undefined);
        }
      } else {
        setSectionValues({});
        setInitialTemplateName(undefined);
      }
      setSelectedTemplate(null);
    } else {
      setTitle("");
      setContentType("Article");
      setContentUri("");
      setOrderIndex(0);
      setTextContent("");
      setVideoUrl("");
      setEstimatedDuration("");
      setSelectedTemplate(null);
      setSectionValues({});
      setInitialTemplateName(undefined);
    }
    setFile(null);
    setIsUploading(false);
    setStep(chapter ? 1 : 0);
    setFormError(null);
    setFieldErrors({});
  }, [chapter, open]);

  function extractErrorMessage(err: unknown): string {
    if (err instanceof ApiError) return err.errors[0] ?? err.message;
    if (err instanceof Error) return err.message;
    return t("errors.unexpected");
  }

  const { mutateAsync: doAdd, isLoading: adding } = useApiMutation(
    (input: CreateChapterInput) => addChapter(trainingId, input),
    {
      onSuccess: () => {
        setFormError(null);
        onSuccess();
      },
      onError: (err) => setFormError(extractErrorMessage(err)),
    }
  );

  const { mutateAsync: doUpdate, isLoading: updating } = useApiMutation(
    (input: UpdateChapterInput) =>
      updateChapter(trainingId, chapter!.id, input),
    {
      onSuccess: () => {
        setFormError(null);
        onSuccess();
      },
      onError: (err) => setFormError(extractErrorMessage(err)),
    }
  );

  const isSaving = adding || updating || isUploading;

  function validateStep0(): boolean {
    const errors: Record<string, string> = {};
    if (!title.trim()) errors.title = t("errors.titleRequired");
    else if (title.trim().length < 2) errors.title = t("errors.titleMinLength");
    if (orderIndex < 0) errors.orderIndex = t("errors.orderIndexNonNegative");
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateStep1(): boolean {
    const errors: Record<string, string> = {};
    const needsFile =
      contentType === "Pdf" || (contentType === "Video" && !videoUrl);
    if (needsFile && !file && !contentUri)
      errors.file =
        contentType === "Pdf" ? t("errors.uploadPdf") : t("errors.uploadVideo");
    if (
      contentType === "Video" &&
      videoUrl &&
      !/^https?:\/\/.+/i.test(videoUrl)
    )
      errors.videoUrl = t("errors.videoUrlInvalid");
    if (estimatedDuration !== "" && estimatedDuration <= 0)
      errors.estimatedDuration = t("errors.durationPositive");
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  const handleNext = useCallback(() => {
    if (step === 0) {
      // Step 0 is the type picker — just advance
      setStep(1);
    } else if (validateStep0()) {
      setStep(step + 1);
    }
  }, [step, title, orderIndex]);

  const handleSectionChange = useCallback(
    (sectionId: string, value: string) => {
      setSectionValues((prev) => ({ ...prev, [sectionId]: value }));
    },
    []
  );

  // When a template is selected, remap any label-keyed section values to section-ID keys
  const handleTemplateChange = useCallback(
    (template: ArticleTemplate | null) => {
      setSelectedTemplate(template);
      if (!template) return;
      setSectionValues((prev) => {
        const hasLabelKeys = template.sections.some(
          (s) => prev[s.label] !== undefined
        );
        if (!hasLabelKeys) return prev;
        const remapped: Record<string, string> = {};
        for (const section of template.sections) {
          remapped[section.id] = prev[section.label] ?? prev[section.id] ?? "";
        }
        return remapped;
      });
    },
    []
  );

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

    // For Articles with templates, serialize sections as structured JSON into textContent.
    // Store as an array of { label, content } for self-describing player rendering.
    let resolvedTextContent: string | undefined;
    if (contentType === "Article" && selectedTemplate) {
      const sectionArray = [...selectedTemplate.sections]
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((s) => ({ label: s.label, content: sectionValues[s.id] ?? "" }));
      resolvedTextContent = JSON.stringify({
        templateName: selectedTemplate.name,
        sections: sectionArray,
      });
    } else {
      resolvedTextContent = textContent || undefined;
    }

    const payload = {
      title: title.trim(),
      contentType,
      contentUri: uploadedUri || undefined,
      orderIndex,
      textContent: resolvedTextContent,
      videoUrl: !file && videoUrl ? videoUrl : undefined,
      estimatedDurationMinutes: estimatedDuration || undefined,
    };
    if (isEditing) await doUpdate(payload);
    else await doAdd(payload);
  }, [
    title,
    contentType,
    contentUri,
    orderIndex,
    textContent,
    videoUrl,
    estimatedDuration,
    file,
    isEditing,
    doUpdate,
    doAdd,
    selectedTemplate,
    sectionValues,
  ]);

  const canAdvance = title.trim().length > 0;
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
    contentType,
    setContentType,
    contentUri,
    setContentUri,
    orderIndex,
    setOrderIndex,
    textContent,
    setTextContent,
    videoUrl,
    setVideoUrl,
    estimatedDuration,
    setEstimatedDuration,
    file,
    setFile,
    isUploading,
    selectedTemplate,
    handleTemplateChange,
    sectionValues,
    handleSectionChange,
    initialTemplateName,
    isSaving,
    handleNext,
    handleSubmit,
    canAdvance,
  };
}
