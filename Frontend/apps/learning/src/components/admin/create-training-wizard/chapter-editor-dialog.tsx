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
import { useTranslations } from "next-intl";
import type { WizardChapter } from "@/types/admin";
import type { ChapterLayout } from "@/types";

const LAYOUT_VALUES: ChapterLayout[] = [
  "SingleContent",
  "SplitLayout",
  "MultiSection",
];

interface ChapterEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingChapter: WizardChapter | null;
  onAdd: (chapter: Omit<WizardChapter, "clientId">) => void;
  onSaveEdit: (chapter: Omit<WizardChapter, "clientId">) => void;
}

export function ChapterEditorDialog({
  open,
  onOpenChange,
  editingChapter,
  onAdd,
  onSaveEdit,
}: ChapterEditorDialogProps) {
  const t = useTranslations("adminWizard.editor");
  const tCommon = useTranslations("common");
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
    const data: Omit<WizardChapter, "clientId"> = {
      title: title.trim(),
      layout,
    };
    if (isEditing) onSaveEdit(data);
    else onAdd(data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("dialog.editTitle") : t("dialog.addTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <Label className="text-[13px] font-semibold">
              {t("dialog.titleLabel")}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("dialog.titlePlaceholder")}
              maxLength={200}
            />
          </div>

          {/* Layout */}
          <div className="space-y-2">
            <Label className="text-[13px] font-semibold">
              {t("dialog.layoutLabel")}
            </Label>
            <Select
              value={layout}
              onValueChange={(v) => setLayout(v as ChapterLayout)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LAYOUT_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`layout.${value}`)}
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
              {tCommon("actions.cancel")}
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
              {isEditing ? t("dialog.saveChanges") : t("dialog.addTitle")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
