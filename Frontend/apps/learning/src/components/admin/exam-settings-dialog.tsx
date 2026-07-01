"use client";

import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@repo/ui";
import type { UpdateExamInput } from "@/types/admin";
import { ExamSettingsForm } from "./exam-settings-form";

export function ExamSettingsDialog({
  open,
  onOpenChange,
  exam,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: {
    title: string;
    description?: string;
    passingScore: number;
    durationMinutes?: number;
  };
  onSubmit: (input: UpdateExamInput) => Promise<void>;
}) {
  const t = useTranslations("adminExam");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settingsDialog.title")}</DialogTitle>
        </DialogHeader>
        <ExamSettingsForm
          mode="edit"
          initialValues={exam}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
