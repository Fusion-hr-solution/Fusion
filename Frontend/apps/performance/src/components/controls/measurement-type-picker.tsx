"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { parseMeasurementTypes, formatMeasurementTypes, type MeasurementSet } from "@/lib/labels";

interface MeasurementTypePickerProps {
  value: string;
  onChange: (csv: string) => void;
  disabled?: boolean;
  requireAtLeastOne?: boolean;
}

const OPTIONS = [
  { key: "numeric" as keyof MeasurementSet, label: "Numeric targets" },
  { key: "qualitative" as keyof MeasurementSet, label: "Qualitative outcomes" },
] as const;

export function MeasurementTypePicker({
  value,
  onChange,
  disabled,
  requireAtLeastOne = true,
}: MeasurementTypePickerProps) {
  const set = parseMeasurementTypes(value);
  const selected = OPTIONS.filter(({ key }) => set[key]).map(({ key }) => String(key));

  const handleChange = (nextValues: string[]) => {
    if (requireAtLeastOne && nextValues.length === 0) return;

    onChange(
      formatMeasurementTypes({
        numeric: nextValues.includes("numeric"),
        qualitative: nextValues.includes("qualitative"),
      }),
    );
  };

  return (
    <ToggleGroup
      type="multiple"
      variant="outline"
      spacing={2}
      value={selected}
      onValueChange={handleChange}
      disabled={disabled}
      className="flex w-full flex-wrap"
      aria-label="Measurement methods"
    >
      {OPTIONS.map(({ key, label }) => {
        return (
          <ToggleGroupItem
            key={key}
            value={String(key)}
            className="min-h-9 rounded-full px-3"
          >
            {label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
