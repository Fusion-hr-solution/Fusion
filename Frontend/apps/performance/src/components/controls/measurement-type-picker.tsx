"use client";

import { cn } from "@/lib/utils";
import { parseMeasurementTypes, formatMeasurementTypes, type MeasurementSet } from "@/lib/labels";

interface MeasurementTypePickerProps {
  value: string; // "Quantitative", "Qualitative", or "Quantitative,Qualitative"
  onChange: (csv: string) => void;
  disabled?: boolean;
  requireAtLeastOne?: boolean;
}

const OPTIONS = [
  { key: "numeric" as keyof MeasurementSet, label: "Numeric targets", hint: "e.g. 95% retention, 120 calls/day" },
  { key: "qualitative" as keyof MeasurementSet, label: "Qualitative outcomes", hint: "e.g. delivered training programme" },
] as const;

export function MeasurementTypePicker({
  value,
  onChange,
  disabled,
  requireAtLeastOne = true,
}: MeasurementTypePickerProps) {
  const set = parseMeasurementTypes(value);

  const toggle = (key: keyof MeasurementSet) => {
    const next = { ...set, [key]: !set[key] };
    if (requireAtLeastOne && !next.numeric && !next.qualitative) return;
    onChange(formatMeasurementTypes(next));
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {OPTIONS.map(({ key, label, hint }) => {
        const active = set[key];
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => toggle(key)}
            aria-pressed={active}
            className={cn(
              "flex-1 rounded-md border px-4 py-3 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-primary bg-primary/8 text-foreground"
                : "border-border bg-background hover:bg-muted text-foreground",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            <span className="block text-sm font-medium">{label}</span>
            <span className="block text-xs text-muted-foreground mt-0.5">{hint}</span>
          </button>
        );
      })}
    </div>
  );
}
