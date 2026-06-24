"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@repo/ui";
import { useApiMutation } from "@repo/api/react";
import { ApiError } from "@repo/api";
import {
  addContentBlock,
  updateContentBlock,
  uploadChapterFile,
} from "@/services/admin-service";
import type {
  AdminContentBlock,
  CreateContentBlockInput,
  UpdateContentBlockInput,
} from "@/types/admin";
import { ChapterTypePicker } from "./create-training-wizard/chapter-type-picker";
import { CONTENT_TYPES } from "@/data/chapter-templates";
import { FileUploadZone } from "./file-upload-zone";

interface ContentBlockEditorDialogProps {
  trainingId: string;
  chapterId: string;
  block: AdminContentBlock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function ContentBlockEditorDialog({
  trainingId,
  chapterId,
  block,
  open,
  onOpenChange,
  onSaved,
}: ContentBlockEditorDialogProps) {
  const t = useTranslations("adminChapters");
  const tCommon = useTranslations("common.actions");
  const isEditing = Boolean(block);
  const [contentType, setContentType] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [contentUri, setContentUri] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState<number | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (block) {
      setContentType(block.type);
      setTitle(block.title ?? "");
      setTextContent(block.textContent ?? "");
      setVideoUrl(block.videoUrl ?? "");
      setContentUri(block.contentUri ?? "");
      setEstimatedDuration(block.estimatedDurationMinutes ?? "");
    } else {
      setContentType(null);
      setTitle("");
      setTextContent("");
      setVideoUrl("");
      setContentUri("");
      setEstimatedDuration("");
    }
    setFile(null);
    setIsUploading(false);
    setFormError(null);
  }, [block, open]);

  function extractError(err: unknown): string {
    if (err instanceof ApiError) return err.errors[0] ?? err.message;
    if (err instanceof Error) return err.message;
    return t("blockEditor.unexpectedError");
  }

  const { mutateAsync: doAdd, isLoading: adding } = useApiMutation(
    (input: CreateContentBlockInput) =>
      addContentBlock(trainingId, chapterId, input),
    {
      onSuccess: () => {
        onOpenChange(false);
        onSaved();
      },
      onError: (e) => setFormError(extractError(e)),
    }
  );

  const { mutateAsync: doUpdate, isLoading: updating } = useApiMutation(
    (input: UpdateContentBlockInput) =>
      updateContentBlock(trainingId, chapterId, block!.id, input),
    {
      onSuccess: () => {
        onOpenChange(false);
        onSaved();
      },
      onError: (e) => setFormError(extractError(e)),
    }
  );

  const isSaving = adding || updating || isUploading;

  const handleSubmit = useCallback(async () => {
    if (!contentType) return;
    setFormError(null);

    let uploadedUri = contentUri;
    if (file) {
      try {
        setIsUploading(true);
        uploadedUri = await uploadChapterFile(file);
      } catch (err) {
        setFormError(extractError(err));
        return;
      } finally {
        setIsUploading(false);
      }
    }

    const payload = {
      type: contentType,
      title: title.trim() || undefined,
      textContent: textContent || undefined,
      contentUri: uploadedUri || undefined,
      videoUrl: !file && videoUrl ? videoUrl : undefined,
      estimatedDurationMinutes: estimatedDuration || undefined,
    };

    if (isEditing) {
      await doUpdate(payload);
    } else {
      await doAdd({ ...payload, orderIndex: 0 });
    }
  }, [
    contentType,
    title,
    textContent,
    contentUri,
    videoUrl,
    estimatedDuration,
    file,
    isEditing,
    doAdd,
    doUpdate,
  ]);

  const typeConfig = CONTENT_TYPES.find((t) => t.type === contentType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("blockEditor.editTitle") : t("blockEditor.addTitle")}
          </DialogTitle>
        </DialogHeader>

        {formError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {!contentType ? (
          <ChapterTypePicker onSelect={setContentType} />
        ) : (
          <div className="space-y-5">
            {!isEditing && (
              <button
                onClick={() => setContentType(null)}
                className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />{" "}
                {t("blockEditor.changeType")}
              </button>
            )}

            {typeConfig && (
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${typeConfig.colorClass}`}
                >
                  <typeConfig.icon
                    className={`h-4 w-4 ${typeConfig.iconColorClass}`}
                  />
                </div>
                <span className="text-[13px] font-semibold text-foreground">
                  {t(`contentTypes.${typeConfig.type}.label`)}
                </span>
              </div>
            )}

            {/* Title (optional) */}
            <div className="space-y-2">
              <Label className="text-[13px] font-semibold">
                {t("blockEditor.blockTitleLabel")}
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("blockEditor.blockTitlePlaceholder")}
                maxLength={300}
              />
            </div>

            {/* Type-specific fields */}
            {contentType === "Article" && (
              <div className="space-y-2">
                <Label className="text-[13px] font-semibold">
                  {t("blockEditor.articleContentLabel")}
                </Label>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder={t("blockEditor.articleContentPlaceholder")}
                  rows={8}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            )}

            {contentType === "Exercise" && (
              <div className="space-y-2">
                <Label className="text-[13px] font-semibold">
                  {t("blockEditor.exerciseContentLabel")}
                </Label>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder={t("blockEditor.exerciseContentPlaceholder")}
                  rows={8}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            )}

            {contentType === "Video" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[13px] font-semibold">
                    {t("blockEditor.videoFileLabel")}
                  </Label>
                  <FileUploadZone
                    accept="video/*"
                    file={file}
                    onFileChange={setFile}
                    existingUrl={contentUri}
                    label={t("blockEditor.videoUploadHint")}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px] font-semibold">
                    {t("blockEditor.externalUrlLabel")}
                  </Label>
                  <Input
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder={t("blockEditor.externalUrlPlaceholder")}
                    disabled={Boolean(file)}
                  />
                </div>
              </div>
            )}

            {contentType === "Pdf" && (
              <div className="space-y-2">
                <Label className="text-[13px] font-semibold">
                  {t("blockEditor.pdfFileLabel")}
                </Label>
                <FileUploadZone
                  accept=".pdf"
                  file={file}
                  onFileChange={setFile}
                  existingUrl={contentUri}
                  label={t("blockEditor.pdfUploadHint")}
                />
              </div>
            )}

            {/* Duration */}
            <div className="space-y-2">
              <Label className="text-[13px] font-semibold">
                {t("blockEditor.estimatedDurationLabel")}
              </Label>
              <Input
                type="number"
                min={1}
                max={600}
                value={estimatedDuration}
                onChange={(e) =>
                  setEstimatedDuration(
                    e.target.value ? Number(e.target.value) : ""
                  )
                }
                placeholder={t("blockEditor.estimatedDurationPlaceholder")}
                className="w-32"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
              >
                {tCommon("cancel")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className={`rounded-xl px-6 py-2.5 text-sm font-semibold shadow-sm transition-all ${
                  !isSaving
                    ? "ey-bg-dark text-white hover:opacity-90 active:scale-[0.98]"
                    : "cursor-not-allowed bg-muted text-muted-foreground"
                }`}
              >
                {isSaving ? (
                  <span className="flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isUploading
                      ? t("blockEditor.uploading")
                      : tCommon("saving")}
                  </span>
                ) : isEditing ? (
                  t("blockEditor.saveChanges")
                ) : (
                  t("blockEditor.addBlock")
                )}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
