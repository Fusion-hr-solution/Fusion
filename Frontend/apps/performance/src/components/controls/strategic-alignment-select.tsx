"use client";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const OPTIONS = [
  { value: "Disabled", label: "Not used" },
  { value: "Optional", label: "Optional" },
  { value: "Required", label: "Required" },
] as const;

interface StrategicAlignmentSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function StrategicAlignmentSelect({
  value,
  onChange,
  disabled,
}: StrategicAlignmentSelectProps) {
  return (
    <RadioGroup
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      className="grid gap-2 sm:grid-cols-3"
      aria-label="Strategic alignment"
    >
      {OPTIONS.map((option) => (
        <Label
          key={option.value}
          htmlFor={`strategic-alignment-${option.value}`}
          className={cn(
            "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
            value === option.value
              ? "border-primary bg-primary/12 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]"
              : "border-border bg-background hover:bg-muted/60",
          )}
        >
          <RadioGroupItem id={`strategic-alignment-${option.value}`} value={option.value} />
          <span>{option.label}</span>
        </Label>
      ))}
    </RadioGroup>
  );
}
