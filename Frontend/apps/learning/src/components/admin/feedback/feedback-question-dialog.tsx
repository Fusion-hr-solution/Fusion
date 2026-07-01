"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import type { FeedbackQuestionType } from "@/types";

interface FeedbackQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: FeedbackQuestionType;
  isEdit: boolean;
  initialLabel?: string;
  initialOptions?: string;
  onSave: (label: string, options?: string) => Promise<void>;
}

function optionsToText(options?: string): string {
  if (!options) return "";
  try {
    const parsed: unknown = JSON.parse(options);
    return Array.isArray(parsed) ? parsed.map((o) => String(o)).join("\n") : "";
  } catch {
    return "";
  }
}

export function FeedbackQuestionDialog({
  open,
  onOpenChange,
  type,
  isEdit,
  initialLabel = "",
  initialOptions,
  onSave,
}: FeedbackQuestionDialogProps) {
  const t = useTranslations("adminFeedback");
  const [label, setLabel] = useState(initialLabel);
  const [optionsText, setOptionsText] = useState(optionsToText(initialOptions));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLabel(initialLabel);
      setOptionsText(optionsToText(initialOptions));
    }
  }, [open, initialLabel, initialOptions]);

  const isMultiple = type === "MultipleChoice";
  const options = optionsText
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const canSave = label.trim().length > 0 && (!isMultiple || options.length >= 2) && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave(label.trim(), isMultiple ? JSON.stringify(options) : undefined);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("builder.editQuestion") : t("builder.newQuestion")}</DialogTitle>
          <DialogDescription>{t(`questionType.${type}`)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label htmlFor="fq-label" className="text-sm font-medium text-foreground">
              {t("builder.label")}
            </label>
            <input
              id="fq-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {isMultiple ? (
            <div className="space-y-1.5">
              <label htmlFor="fq-options" className="text-sm font-medium text-foreground">
                {t("builder.options")}
              </label>
              <textarea
                id="fq-options"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                rows={4}
                placeholder={t("builder.optionsPlaceholder")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("builder.cancel")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            {t("builder.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
