"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPTIONS = [
  { value: "Disabled", label: "Not used", description: "Objectives are standalone" },
  { value: "Optional", label: "Optional", description: "Employees may align to company priorities" },
  { value: "Required", label: "Required", description: "Employees must align each objective" },
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
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full max-w-xs">
        <SelectValue placeholder="Select alignment mode" />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            <span className="font-medium">{opt.label}</span>
            <span className="ml-2 text-xs text-muted-foreground">&mdash; {opt.description}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
