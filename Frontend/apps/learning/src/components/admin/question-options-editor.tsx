"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, Input, Label } from "@repo/ui";

export interface OptionDraft {
  clientId: string;
  optionText: string;
  isCorrect: boolean;
}

export function QuestionOptionsEditor({
  options,
  type,
  onToggleCorrect,
  onOptionTextChange,
  onAddOption,
  onRemoveOption,
}: {
  options: OptionDraft[];
  type: "SingleChoice" | "MultipleChoice" | "TrueFalse";
  onToggleCorrect: (clientId: string) => void;
  onOptionTextChange: (clientId: string, text: string) => void;
  onAddOption: () => void;
  onRemoveOption: (clientId: string) => void;
}) {
  const isTrueFalse = type === "TrueFalse";
  const hasCorrect = options.some((o) => o.isCorrect);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[13px] font-semibold">
          Options <span className="text-destructive">*</span>
        </Label>
        {!isTrueFalse && (
          <Button type="button" variant="outline" size="sm" onClick={onAddOption} className="h-7 text-xs">
            <Plus className="mr-1 h-3 w-3" /> Add Option
          </Button>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {type === "SingleChoice" ? "Select the one correct answer" : type === "MultipleChoice" ? "Select all correct answers" : "Select the correct answer"}
      </p>

      <div className="space-y-2" role="group" aria-label="Answer options">
        {options.map((opt, i) => (
          <div key={opt.clientId} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleCorrect(opt.clientId)}
              aria-pressed={opt.isCorrect}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${opt.isCorrect ? "border-[hsl(var(--ey-green-500))] bg-[hsl(var(--ey-green-500))] text-white" : "border-border hover:border-muted-foreground"}`}
              aria-label={opt.isCorrect ? "Marked correct" : "Mark as correct"}
            >
              {opt.isCorrect && (
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <Input value={opt.optionText} onChange={(e) => onOptionTextChange(opt.clientId, e.target.value)} placeholder={`Option ${i + 1}`} aria-label={`Option ${i + 1}`} maxLength={500} disabled={isTrueFalse} className="flex-1" />
            {!isTrueFalse && options.length > 2 && (
              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive" onClick={() => onRemoveOption(opt.clientId)} aria-label={`Remove option ${i + 1}`}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {!hasCorrect && options.length > 0 && (
        <p className="text-[11px] text-destructive">At least one option must be marked as correct</p>
      )}
    </div>
  );
}
