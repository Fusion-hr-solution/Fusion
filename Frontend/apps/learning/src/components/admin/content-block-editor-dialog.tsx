"use client";

import { useState, useEffect, useCallback } from "react";
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
import { addContentBlock, updateContentBlock, uploadChapterFile } from "@/services/admin-service";
import type { AdminContentBlock, CreateContentBlockInput, UpdateContentBlockInput } from "@/types/admin";
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
    return "An unexpected error occurred.";
  }

  const { mutateAsync: doAdd, isLoading: adding } = useApiMutation(
    (input: CreateContentBlockInput) => addContentBlock(trainingId, chapterId, input),
    { onSuccess: () => { onOpenChange(false); onSaved(); }, onError: (e) => setFormError(extractError(e)) },
  );

  const { mutateAsync: doUpdate, isLoading: updating } = useApiMutation(
    (input: UpdateContentBlockInput) => updateContentBlock(trainingId, chapterId, block!.id, input),
    { onSuccess: () => { onOpenChange(false); onSaved(); }, onError: (e) => setFormError(extractError(e)) },
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
      videoUrl: (!file && videoUrl) ? videoUrl : undefined,
      estimatedDurationMinutes: estimatedDuration || undefined,
    };

    if (isEditing) {
      await doUpdate(payload);
    } else {
      await doAdd({ ...payload, orderIndex: 0 });
    }
  }, [contentType, title, textContent, contentUri, videoUrl, estimatedDuration, file, isEditing, doAdd, doUpdate]);

  const typeConfig = CONTENT_TYPES.find((t) => t.type === contentType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Content Block" : "Add Content Block"}</DialogTitle>
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
                <ArrowLeft className="h-3.5 w-3.5" /> Change type
              </button>
            )}

            {typeConfig && (
              <div className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${typeConfig.colorClass}`}>
                  <typeConfig.icon className={`h-4 w-4 ${typeConfig.iconColorClass}`} />
                </div>
                <span className="text-[13px] font-semibold text-foreground">{typeConfig.label}</span>
              </div>
            )}

            {/* Title (optional) */}
            <div className="space-y-2">
              <Label className="text-[13px] font-semibold">Block Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional title" maxLength={300} />
            </div>

            {/* Type-specific fields */}
            {contentType === "Article" && (
              <div className="space-y-2">
                <Label className="text-[13px] font-semibold">Article Content</Label>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Write your article content here (supports basic markdown)..."
                  rows={8}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            )}

            {contentType === "Exercise" && (
              <div className="space-y-2">
                <Label className="text-[13px] font-semibold">Exercise Content</Label>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Instructions, tasks, hints, solution..."
                  rows={8}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            )}

            {contentType === "Video" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[13px] font-semibold">Video File</Label>
                  <FileUploadZone accept="video/*" file={file} onFileChange={setFile} existingUrl={contentUri} label="Upload video file" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px] font-semibold">Or External URL</Label>
                  <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/embed/..." disabled={Boolean(file)} />
                </div>
              </div>
            )}

            {contentType === "Pdf" && (
              <div className="space-y-2">
                <Label className="text-[13px] font-semibold">PDF File</Label>
                <FileUploadZone accept=".pdf" file={file} onFileChange={setFile} existingUrl={contentUri} label="Upload PDF file" />
              </div>
            )}

            {/* Duration */}
            <div className="space-y-2">
              <Label className="text-[13px] font-semibold">Estimated Duration (minutes)</Label>
              <Input
                type="number"
                min={1}
                max={600}
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(e.target.value ? Number(e.target.value) : "")}
                placeholder="e.g. 15"
                className="w-32"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
              >
                Cancel
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
                    {isUploading ? "Uploading..." : "Saving..."}
                  </span>
                ) : isEditing ? "Save Changes" : "Add Block"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
