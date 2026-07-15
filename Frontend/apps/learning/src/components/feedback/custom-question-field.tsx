"use client";

import { useTranslations } from "next-intl";
import { Button } from "@repo/ui";
import type { FeedbackQuestion } from "@/types";
import { StarRating } from "./star-rating";

interface CustomQuestionFieldProps {
  question: FeedbackQuestion;
  value: string;
  onChange: (value: string) => void;
}

function parseOptions(options?: string): string[] {
  if (!options) return [];
  try {
    const parsed: unknown = JSON.parse(options);
    return Array.isArray(parsed) ? parsed.map((o) => String(o)) : [];
  } catch {
    return [];
  }
}

const SELECTED =
  "border-[hsl(var(--ey-blue-500))] bg-[hsl(var(--ey-blue-500))]/10 text-foreground";
const UNSELECTED = "border-border/60 text-muted-foreground hover:bg-muted";

export function CustomQuestionField({ question, value, onChange }: CustomQuestionFieldProps) {
  const t = useTranslations("feedback");

  function control() {
    switch (question.type) {
      case "StarRating":
        return (
          <StarRating
            label={question.label}
            value={Number(value) || 0}
            onChange={(v) => onChange(String(v))}
          />
        );
      case "Scale10":
        return (
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={question.label}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={value === String(n)}
                aria-label={`${n} / 10`}
                onClick={() => onChange(String(n))}
                className={`h-8 w-8 rounded-md border text-xs font-medium transition-colors ${
                  value === String(n) ? SELECTED : UNSELECTED
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        );
      case "YesNo":
        return (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={value === "Yes" ? "default" : "outline"}
              onClick={() => onChange("Yes")}
            >
              {t("form.recommendYes")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={value === "No" ? "default" : "outline"}
              onClick={() => onChange("No")}
            >
              {t("form.recommendNo")}
            </Button>
          </div>
        );
      case "MultipleChoice": {
        const options = parseOptions(question.options);
        return (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={question.label}>
            {options.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={value === option}
                onClick={() => onChange(option)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  value === option ? SELECTED : UNSELECTED
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        );
      }
      case "FreeText":
        return (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">{question.label}</p>
      {control()}
    </div>
  );
}
