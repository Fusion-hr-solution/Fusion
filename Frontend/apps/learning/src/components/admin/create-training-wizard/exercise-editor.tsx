"use client";

import { useState, useEffect } from "react";
import { Label } from "@repo/ui";
import { useTranslations } from "next-intl";

interface ExerciseEditorProps {
  textContent: string;
  onTextContentChange: (value: string) => void;
}

export function ExerciseEditor({
  textContent,
  onTextContentChange,
}: ExerciseEditorProps) {
  const t = useTranslations("adminWizard.editor.exercise");
  const parsed = safeParse(textContent);
  const [instructions, setInstructions] = useState(parsed?.instructions ?? "");
  const [tasks, setTasks] = useState(parsed?.tasks ?? "");
  const [hints, setHints] = useState(parsed?.hints ?? "");
  const [solution, setSolution] = useState(parsed?.solution ?? "");

  useEffect(() => {
    const json = JSON.stringify({ instructions, tasks, hints, solution });
    onTextContentChange(json);
  }, [instructions, tasks, hints, solution, onTextContentChange]);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
      <div className="space-y-1.5">
        <Label className="text-[12px] font-semibold">{t("instructions")}</Label>
        <textarea
          rows={3}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={t("instructionsPlaceholder")}
          className="flex w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground transition-colors hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[12px] font-semibold">{t("tasks")}</Label>
        <textarea
          rows={4}
          value={tasks}
          onChange={(e) => setTasks(e.target.value)}
          placeholder={t("tasksPlaceholder")}
          className="flex w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground transition-colors hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[12px] font-semibold">
          {t("hints")}{" "}
          <span className="text-muted-foreground font-normal">
            {t("optional")}
          </span>
        </Label>
        <textarea
          rows={2}
          value={hints}
          onChange={(e) => setHints(e.target.value)}
          placeholder={t("hintsPlaceholder")}
          className="flex w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground transition-colors hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[12px] font-semibold">
          {t("solution")}{" "}
          <span className="text-muted-foreground font-normal">
            {t("optional")}
          </span>
        </Label>
        <textarea
          rows={3}
          value={solution}
          onChange={(e) => setSolution(e.target.value)}
          placeholder={t("solutionPlaceholder")}
          className="flex w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground transition-colors hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
    </div>
  );
}

function safeParse(json: string) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
