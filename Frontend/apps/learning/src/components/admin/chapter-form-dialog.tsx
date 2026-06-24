"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
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
import { useApiMutation } from "@repo/api/react";
import { ApiError } from "@repo/api";
import { addChapter, updateChapter } from "@/services/admin-service";
import type { ChapterFormDialogProps } from "@/types/admin-props";
import type { ChapterLayout } from "@/types";

const LAYOUT_OPTIONS: ChapterLayout[] = [
  "SingleContent",
  "SplitLayout",
  "MultiSection",
];

export function ChapterFormDialog({
  trainingId,
  chapter,
  open,
  onOpenChange,
  onSaved,
}: ChapterFormDialogProps) {
  const t = useTranslations("adminChapters");
  const tCommon = useTranslations("common.actions");
  const isEditing = Boolean(chapter);
  const [title, setTitle] = useState("");
  const [layout, setLayout] = useState<ChapterLayout>("SingleContent");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(chapter?.title ?? "");
      setLayout((chapter?.layout as ChapterLayout) ?? "SingleContent");
      setFormError(null);
    }
  }, [chapter, open]);

  function extractError(err: unknown): string {
    if (err instanceof ApiError) return err.errors[0] ?? err.message;
    if (err instanceof Error) return err.message;
    return t("chapterDialog.unexpectedError");
  }

  const { mutateAsync: doAdd, isLoading: adding } = useApiMutation(
    () =>
      addChapter(trainingId, { title: title.trim(), layout, orderIndex: 0 }),
    {
      onSuccess: () => {
        onOpenChange(false);
        onSaved();
      },
      onError: (err) => setFormError(extractError(err)),
    }
  );

  const { mutateAsync: doUpdate, isLoading: updating } = useApiMutation(
    () =>
      updateChapter(trainingId, chapter!.id, { title: title.trim(), layout }),
    {
      onSuccess: () => {
        onOpenChange(false);
        onSaved();
      },
      onError: (err) => setFormError(extractError(err)),
    }
  );

  const isSaving = adding || updating;
  const canSubmit = title.trim().length > 0 && !isSaving;

  async function handleSubmit() {
    if (!canSubmit) return;
    setFormError(null);
    if (isEditing) await doUpdate(undefined);
    else await doAdd(undefined);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t("chapterDialog.editTitle")
              : t("chapterDialog.addTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {formError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-[13px] font-semibold">
              {t("chapterDialog.titleLabel")}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("chapterDialog.titlePlaceholder")}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] font-semibold">
              {t("chapterDialog.layoutLabel")}
            </Label>
            <Select
              value={layout}
              onValueChange={(v) => setLayout(v as ChapterLayout)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LAYOUT_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {t(`chapterDialog.layout.${opt}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
            >
              {tCommon("cancel")}
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
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tCommon("saving")}
                </span>
              ) : isEditing ? (
                t("chapterDialog.saveChanges")
              ) : (
                t("chapterDialog.addChapter")
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
