"use client";

import { Loader2, Save, ArrowLeft, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Button,
} from "@repo/ui";
import type { ChapterFormDialogProps } from "@/types/admin-props";
import { useChapterForm } from "@/hooks/use-chapter-form";
import { ChapterTypePicker } from "./create-training-wizard/chapter-type-picker";
import { CONTENT_TYPES } from "@/data/chapter-templates";
import { ChapterFormContentStep } from "./chapter-form-content-step";

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

  const typeConfig = CONTENT_TYPES.find((t) => t.type === form.contentType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.isEditing ? "Edit Chapter" : "Add Chapter"}</DialogTitle>
        </DialogHeader>

        {form.formError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{form.formError}</span>
          </div>
        )}

        {/* Step 0: Type picker (new chapters only, before advancing) */}
        {form.step === 0 && !form.isEditing ? (
          <div className="py-2">
            <ChapterTypePicker
              onSelect={(type) => {
                form.setContentType(type);
                form.handleNext();
              }}
            />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Back to type picker (new chapters only) */}
            {!form.isEditing && (
              <button
                onClick={() => form.setStep(0)}
                className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Change type
              </button>
            )}

            {/* Type badge */}
            {typeConfig && (
              <div className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${typeConfig.colorClass}`}>
                  <typeConfig.icon className={`h-4 w-4 ${typeConfig.iconColorClass}`} />
                </div>
                <span className="text-[13px] font-semibold text-foreground">{typeConfig.label}</span>
              </div>
            )}

            {/* Title */}
            <div className="space-y-2">
              <Label className="text-[13px] font-semibold">
                Chapter Title <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.title}
                onChange={(e) => { form.setTitle(e.target.value); form.clearFieldError("title"); }}
                placeholder="e.g. Introduction to the Topic"
                maxLength={200}
                className={form.fieldErrors.title ? "border-destructive" : ""}
              />
              {form.fieldErrors.title && <p className="text-xs text-destructive">{form.fieldErrors.title}</p>}
            </div>

            {/* Content */}
            <ChapterFormContentStep
              contentType={form.contentType}
              file={form.file}
              onFileChange={(f) => { form.setFile(f); form.clearFieldError("file"); }}
              existingFileUrl={form.contentUri}
              textContent={form.textContent}
              onTextContentChange={form.setTextContent}
              videoUrl={form.videoUrl}
              onVideoUrlChange={(v) => { form.setVideoUrl(v); form.clearFieldError("videoUrl"); }}
              estimatedDuration={form.estimatedDuration}
              onEstimatedDurationChange={(v) => { form.setEstimatedDuration(v); form.clearFieldError("estimatedDuration"); }}
              isUploading={form.isUploading}
              selectedTemplate={form.selectedTemplate}
              onTemplateChange={form.handleTemplateChange}
              initialTemplateName={form.initialTemplateName}
              sectionValues={form.sectionValues}
              onSectionChange={form.handleSectionChange}
              fieldErrors={form.fieldErrors}
            />

            {/* Actions */}
            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={form.handleSubmit}
                disabled={form.isSaving || !form.title.trim()}
                className={`rounded-xl px-6 py-2.5 text-sm font-semibold shadow-sm transition-all ${
                  !form.isSaving && form.title.trim()
                    ? "ey-bg-dark text-white hover:opacity-90 active:scale-[0.98]"
                    : "cursor-not-allowed bg-muted text-muted-foreground"
                }`}
              >
                {form.isSaving ? (
                  <span className="flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {form.isUploading ? "Uploading..." : "Saving..."}
                  </span>
                ) : (
                  form.isEditing ? "Save Changes" : "Add Chapter"
                )}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
