"use client";

import { useMemo } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { parseWeightValues, formatWeightValues } from "@/lib/labels";
import { checkWeightFeasibility } from "@/lib/weight-feasibility";

const PRESET_WEIGHTS = [5, 10, 15, 20, 25, 30, 40, 50];

interface WeightPresetEditorProps {
  value: string; // comma-separated, e.g. "10,20,30,40"
  maxObjectives: number;
  onChange: (csv: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function WeightPresetEditor({
  value,
  maxObjectives,
  onChange,
  disabled,
  compact = false,
}: WeightPresetEditorProps) {
  const selected = useMemo(() => parseWeightValues(value), [value]);

  const feasibility = useMemo(
    () => checkWeightFeasibility(value, maxObjectives),
    [value, maxObjectives],
  );

  return (
    <div className="space-y-3">
      <ToggleGroup
        type="multiple"
        variant="outline"
        spacing={2}
        value={selected.map(String)}
        onValueChange={(next) =>
          onChange(
            formatWeightValues(
              next
                .map((entry) => Number(entry))
                .filter((entry) => Number.isFinite(entry))
                .sort((a, b) => a - b),
            ),
          )
        }
        disabled={disabled}
        className="flex w-full flex-wrap"
        aria-label="Allowed objective weights"
      >
        {PRESET_WEIGHTS.map((w) => (
          <ToggleGroupItem
            key={w}
            value={String(w)}
            aria-label={`${w}%`}
            className="min-h-9 rounded-full px-3"
          >
            {w}%
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {!compact && selected.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Selected: {selected.map((w) => `${w}%`).join(", ")}
        </p>
      )}

      {!compact ? (
        <p
          className={
            feasibility.feasible
              ? "text-xs text-emerald-700 dark:text-emerald-300"
              : "text-xs text-destructive"
          }
        >
          {feasibility.feasible ? "100% possible" : feasibility.reason}
        </p>
      ) : null}
    </div>
  );
}
