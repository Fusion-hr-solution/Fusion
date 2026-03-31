"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, ArrowLeft, ArrowRight, FileText, Layers, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
} from "@repo/ui";
import { useApiMutation } from "@repo/api/react";
import { ApiError } from "@repo/api";
import { addChapter, updateChapter } from "@/services/admin-service";
import type { CreateChapterInput, UpdateChapterInput } from "@/types/admin";
import type { ChapterFormDialogProps } from "@/types/admin-props";
import { StepIndicator } from "./step-indicator";
import { ChapterFormInfoStep } from "./chapter-form-info-step";
import { ChapterFormContentStep } from "./chapter-form-content-step";

const STEPS = [
  { label: "Info", icon: <FileText className="h-4 w-4" /> },
  { label: "Content", icon: <Layers className="h-4 w-4" /> },
];

export function ChapterFormDialog({
  trainingId,
  chapter,
  open,
  onOpenChange,
  onSaved,
}: ChapterFormDialogProps) {
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
      onSuccess: () => { setFormError(null); onOpenChange(false); onSaved(); },
      onError: (err) => setFormError(extractErrorMessage(err)),
    },
  );

  const { mutateAsync: doUpdate, isLoading: updating } = useApiMutation(
    (input: UpdateChapterInput) => updateChapter(trainingId, chapter!.id, input),
    {
      onSuccess: () => { setFormError(null); onOpenChange(false); onSaved(); },
      onError: (err) => setFormError(extractErrorMessage(err)),
    },
  );

  const isSaving = adding || updating;

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
    if (contentUri && !/^https?:\/\/.+/i.test(contentUri))
      errors.contentUri = "Content URI must be a valid URL (https://...).";
    if (contentType === "Video" && videoUrl && !/^https?:\/\/.+/i.test(videoUrl))
      errors.videoUrl = "Video URL must be a valid URL (https://...).";
    if (estimatedDuration !== "" && estimatedDuration <= 0)
      errors.estimatedDuration = "Duration must be greater than 0.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleNext() {
    if (validateStep0()) setStep(1);
  }

  async function handleSubmit() {
    if (!validateStep1()) return;
    setFormError(null);
    const payload = {
      title: title.trim(),
      contentType,
      contentUri: contentUri || undefined,
      orderIndex,
      textContent: textContent || undefined,
      videoUrl: videoUrl || undefined,
      estimatedDurationMinutes: estimatedDuration || undefined,
    };
    if (isEditing) await doUpdate(payload);
    else await doAdd(payload);
  }

  const canAdvance = title.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Chapter" : "Add Chapter"}</DialogTitle>
        </DialogHeader>

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
            <ChapterFormInfoStep
              title={title} onTitleChange={(v) => { setTitle(v); setFieldErrors((p) => ({ ...p, title: "" })); }}
              contentType={contentType} onContentTypeChange={setContentType}
              orderIndex={orderIndex} onOrderIndexChange={(v) => { setOrderIndex(v); setFieldErrors((p) => ({ ...p, orderIndex: "" })); }}
              fieldErrors={fieldErrors}
            />
          )}

          {step === 1 && (
            <ChapterFormContentStep
              contentType={contentType}
              contentUri={contentUri} onContentUriChange={(v) => { setContentUri(v); setFieldErrors((p) => ({ ...p, contentUri: "" })); }}
              textContent={textContent} onTextContentChange={setTextContent}
              videoUrl={videoUrl} onVideoUrlChange={(v) => { setVideoUrl(v); setFieldErrors((p) => ({ ...p, videoUrl: "" })); }}
              estimatedDuration={estimatedDuration} onEstimatedDurationChange={(v) => { setEstimatedDuration(v); setFieldErrors((p) => ({ ...p, estimatedDuration: "" })); }}
              fieldErrors={fieldErrors}
            />
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <Button type="button" variant="outline" onClick={() => { setFieldErrors({}); if (step === 0) onOpenChange(false); else setStep(0); }}>
            {step === 0 ? "Cancel" : <><ArrowLeft className="mr-1 h-4 w-4" /> Back</>}
          </Button>

          {step === 0 ? (
            <Button type="button" disabled={!canAdvance} onClick={handleNext} className="ey-bg-dark hover:opacity-90">
              Next <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" disabled={isSaving} onClick={handleSubmit} className="ey-bg-dark hover:opacity-90">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isEditing ? "Update" : "Add"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
