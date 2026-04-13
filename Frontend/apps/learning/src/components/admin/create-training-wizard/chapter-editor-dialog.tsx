"use client";

import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label } from "@repo/ui";
import type { WizardChapter } from "@/types/admin";
import { CONTENT_TYPES } from "@/data/chapter-templates";
import { ChapterTypePicker } from "./chapter-type-picker";
import { ArticleEditor } from "./article-editor";
import { VideoEditor } from "./video-editor";
import { PdfEditor } from "./pdf-editor";
import { ExerciseEditor } from "./exercise-editor";

interface ChapterEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingChapter: WizardChapter | null;
  onAdd: (chapter: Omit<WizardChapter, "clientId">) => void;
  onSaveEdit: (chapter: Omit<WizardChapter, "clientId">) => void;
}

export function ChapterEditorDialog({ open, onOpenChange, editingChapter, onAdd, onSaveEdit }: ChapterEditorDialogProps) {
  const [contentType, setContentType] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [duration, setDuration] = useState<number | "">("");

  useEffect(() => {
    if (editingChapter) {
      setContentType(editingChapter.contentType);
      setTitle(editingChapter.title);
      setTextContent(editingChapter.textContent ?? "");
      setVideoUrl(editingChapter.videoUrl ?? "");
      setDuration(editingChapter.estimatedDurationMinutes ?? "");
      setFile(editingChapter.file ?? null);
    } else {
      setContentType(null);
      setTitle("");
      setTextContent("");
      setVideoUrl("");
      setDuration("");
      setFile(null);
    }
  }, [editingChapter, open]);

  const isEditing = Boolean(editingChapter);
  const canSubmit = title.trim().length > 0 && contentType !== null;
  const typeConfig = CONTENT_TYPES.find((t) => t.type === contentType);

  function handleSubmit() {
    if (!canSubmit || !contentType) return;
    const data: Omit<WizardChapter, "clientId"> = {
      title: title.trim(),
      contentType,
      textContent: textContent || undefined,
      file: file ?? undefined,
      videoUrl: videoUrl || undefined,
      estimatedDurationMinutes: duration || undefined,
    };
    if (isEditing) onSaveEdit(data);
    else onAdd(data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Chapter" : "Add Chapter"}</DialogTitle>
        </DialogHeader>

        {!contentType ? (
          <ChapterTypePicker onSelect={setContentType} />
        ) : (
          <div className="space-y-5">
            {/* Back to type picker (only for new chapters) */}
            {!isEditing && (
              <button
                onClick={() => setContentType(null)}
                className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Change type
              </button>
            )}

            {/* Type badge */}
            <div className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${typeConfig?.colorClass ?? "bg-muted"}`}>
                {typeConfig && <typeConfig.icon className={`h-4 w-4 ${typeConfig.iconColorClass}`} />}
              </div>
              <span className="text-[13px] font-semibold text-foreground">{typeConfig?.label}</span>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label className="text-[13px] font-semibold">Chapter Title <span className="text-destructive">*</span></Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Introduction to the Topic" maxLength={200} />
            </div>

            {/* Type-specific editor */}
            {contentType === "Article" && <ArticleEditor textContent={textContent} onTextContentChange={setTextContent} />}
            {contentType === "Video" && <VideoEditor file={file} onFileChange={setFile} videoUrl={videoUrl} onVideoUrlChange={setVideoUrl} />}
            {contentType === "Pdf" && <PdfEditor file={file} onFileChange={setFile} />}
            {contentType === "Exercise" && <ExerciseEditor textContent={textContent} onTextContentChange={setTextContent} />}

            {/* Duration */}
            <div className="space-y-2">
              <Label className="text-[13px] font-semibold">Estimated Duration (minutes)</Label>
              <Input
                type="number"
                min={1}
                max={600}
                value={duration}
                onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : "")}
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
                disabled={!canSubmit}
                className={`rounded-xl px-6 py-2.5 text-sm font-semibold shadow-sm transition-all ${
                  canSubmit
                    ? "ey-bg-dark text-white hover:opacity-90 active:scale-[0.98]"
                    : "cursor-not-allowed bg-muted text-muted-foreground"
                }`}
              >
                {isEditing ? "Save Changes" : "Add Chapter"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
