"use client";

import { useState, useEffect } from "react";
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
import type { WizardChapter } from "@/types/admin";
import type { ChapterLayout } from "@/types";

const LAYOUT_OPTIONS: { value: ChapterLayout; label: string }[] = [
  { value: "SingleContent", label: "Single Content" },
  { value: "SplitLayout", label: "Split Layout" },
  { value: "MultiSection", label: "Multi Section" },
];

interface ChapterEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingChapter: WizardChapter | null;
  onAdd: (chapter: Omit<WizardChapter, "clientId">) => void;
  onSaveEdit: (chapter: Omit<WizardChapter, "clientId">) => void;
}

export function ChapterEditorDialog({ open, onOpenChange, editingChapter, onAdd, onSaveEdit }: ChapterEditorDialogProps) {
  const [title, setTitle] = useState("");
  const [layout, setLayout] = useState<ChapterLayout>("SingleContent");

  useEffect(() => {
    if (editingChapter) {
      setTitle(editingChapter.title);
      setLayout(editingChapter.layout);
    } else {
      setTitle("");
      setLayout("SingleContent");
    }
  }, [editingChapter, open]);

  const isEditing = Boolean(editingChapter);
  const canSubmit = title.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    const data: Omit<WizardChapter, "clientId"> = { title: title.trim(), layout };
    if (isEditing) onSaveEdit(data);
    else onAdd(data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Chapter" : "Add Chapter"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <Label className="text-[13px] font-semibold">Chapter Title <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Introduction to the Topic" maxLength={200} />
          </div>

          {/* Layout */}
          <div className="space-y-2">
            <Label className="text-[13px] font-semibold">Layout</Label>
            <Select value={layout} onValueChange={(v) => setLayout(v as ChapterLayout)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LAYOUT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
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
      </DialogContent>
    </Dialog>
  );
}
