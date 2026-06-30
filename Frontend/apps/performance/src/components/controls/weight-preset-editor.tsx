"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { parseWeightValues, formatWeightValues } from "@/lib/labels";
import { checkWeightFeasibility } from "@/lib/weight-feasibility";

const PRESET_WEIGHTS = [5, 10, 15, 20, 25, 30, 40, 50];

interface WeightPresetEditorProps {
  value: string; // comma-separated, e.g. "10,20,30,40"
  maxObjectives: number;
  onChange: (csv: string) => void;
  disabled?: boolean;
}

export function WeightPresetEditor({
  value,
  maxObjectives,
  onChange,
  disabled,
}: WeightPresetEditorProps) {
  const selected = useMemo(() => parseWeightValues(value), [value]);

  const toggle = (w: number) => {
    const next = selected.includes(w)
      ? selected.filter((x) => x !== w)
      : [...selected, w].sort((a, b) => a - b);
    onChange(formatWeightValues(next));
  };

  const feasibility = useMemo(
    () => checkWeightFeasibility(value, maxObjectives),
    [value, maxObjectives],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {PRESET_WEIGHTS.map((w) => {
          const active = selected.includes(w);
          return (
            <button
              key={w}
              type="button"
              disabled={disabled}
              onClick={() => toggle(w)}
              aria-pressed={active}
              className={cn(
                "h-8 px-3 rounded-md border text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-background hover:bg-muted text-foreground",
                disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              {w}%
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Selected: {selected.map((w) => `${w}%`).join(", ")}
        </p>
      )}

      <div
        className={cn(
          "rounded-md px-3 py-2 text-xs",
          feasibility.feasible
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "bg-destructive/10 text-destructive",
        )}
      >
        {feasibility.feasible ? (
          <>Employees can reach 100% &mdash; e.g. {feasibility.example}</>
        ) : (
          feasibility.reason
        )}
      </div>
    </div>
  );
}
