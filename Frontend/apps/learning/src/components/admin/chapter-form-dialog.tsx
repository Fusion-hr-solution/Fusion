"use client";

import { Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import type { ChapterFormDialogProps } from "@/types/admin-props";
import type { ChapterLayout } from "@/types";
import { useChapterForm } from "@/hooks/use-chapter-form";

const LAYOUT_OPTIONS: { value: ChapterLayout; label: string; description: string }[] = [
  { value: "SingleContent", label: "Single Content", description: "One content block per view" },
  { value: "SplitLayout", label: "Split Layout", description: "Side-by-side content blocks" },
  { value: "MultiSection", label: "Multi Section", description: "Multiple stacked sections" },
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{form.isEditing ? "Edit Chapter" : "Add Chapter"}</DialogTitle>
        </DialogHeader>

        {form.formError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{form.formError}</span>
          </div>
        )}

        <div className="space-y-5">
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

          {/* Layout */}
          <div className="space-y-2">
            <Label className="text-[13px] font-semibold">Layout</Label>
            <Select value={form.layout} onValueChange={(v) => form.setLayout(v as ChapterLayout)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LAYOUT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div>
                      <span className="font-medium">{opt.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{opt.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  Saving...
                </span>
              ) : (
                form.isEditing ? "Save Changes" : "Add Chapter"
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
