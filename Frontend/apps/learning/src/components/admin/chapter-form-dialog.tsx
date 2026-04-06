"use client";

import { Loader2, Save, ArrowLeft, ArrowRight, FileText, Layers, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
} from "@repo/ui";
import type { ChapterFormDialogProps } from "@/types/admin-props";
import { useChapterForm } from "@/hooks/use-chapter-form";
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
  const form = useChapterForm({
    trainingId,
    chapter,
    open,
    onSuccess: () => { onOpenChange(false); onSaved(); },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.isEditing ? "Edit Chapter" : "Add Chapter"}</DialogTitle>
        </DialogHeader>

        {form.formError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{form.formError}</span>
          </div>
        )}

        <div className="py-2">
          <StepIndicator steps={STEPS} currentStep={form.step} />
        </div>

        <div className="mt-2">
          {form.step === 0 && (
            <ChapterFormInfoStep
              title={form.title} onTitleChange={(v) => { form.setTitle(v); form.clearFieldError("title"); }}
              contentType={form.contentType} onContentTypeChange={form.setContentType}
              orderIndex={form.orderIndex} onOrderIndexChange={(v) => { form.setOrderIndex(v); form.clearFieldError("orderIndex"); }}
              fieldErrors={form.fieldErrors}
            />
          )}

          {form.step === 1 && (
            <ChapterFormContentStep
              contentType={form.contentType}
              file={form.file} onFileChange={(f) => { form.setFile(f); form.clearFieldError("file"); }}
              existingFileUrl={form.contentUri}
              textContent={form.textContent} onTextContentChange={form.setTextContent}
              videoUrl={form.videoUrl} onVideoUrlChange={(v) => { form.setVideoUrl(v); form.clearFieldError("videoUrl"); }}
              estimatedDuration={form.estimatedDuration} onEstimatedDurationChange={(v) => { form.setEstimatedDuration(v); form.clearFieldError("estimatedDuration"); }}
              isUploading={form.isUploading}
              fieldErrors={form.fieldErrors}
            />
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <Button type="button" variant="outline" onClick={() => { if (form.step === 0) onOpenChange(false); else form.setStep(0); }}>
            {form.step === 0 ? "Cancel" : <><ArrowLeft className="mr-1 h-4 w-4" /> Back</>}
          </Button>

          {form.step === 0 ? (
            <Button type="button" disabled={!form.canAdvance} onClick={form.handleNext} className="ey-bg-dark hover:opacity-90">
              Next <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" disabled={form.isSaving} onClick={form.handleSubmit} className="ey-bg-dark hover:opacity-90">
              {form.isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {form.isEditing ? "Update" : "Add"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
