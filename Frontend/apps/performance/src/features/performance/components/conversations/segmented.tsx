"use client";

import { ToggleGroup, ToggleGroupItem } from "@repo/ds/components/ui/toggle-group";
import { cn } from "@repo/ds/lib/utils";

/**
 * A choice between a few named options, in the same shape as Organization direction's Map · List switch: one
 * selected at a time, never empty.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  disabled,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        const match = options.find((option) => option.value === next);
        if (match) onChange(match.value);
      }}
      aria-label={label}
      disabled={disabled}
      className={cn("rounded-control border bg-inlay p-0.5", className)}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className="px-3 type-body text-muted-foreground data-[state=on]:bg-foreground! data-[state=on]:text-background! data-[state=on]:shadow-raised"
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
