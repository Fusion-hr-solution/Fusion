"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui";
import { Laptop, Building2, LayoutGrid } from "lucide-react";
import type { TrainingType } from "@/types";

interface FormatFilterProps {
  value: TrainingType | null;
  onChange: (next: TrainingType | null) => void;
}

/**
 * Catalogue filter dropdown to scope trainings by delivery format
 * (e-learning vs in-person).
 */
export function FormatFilter({ value, onChange }: FormatFilterProps) {
  const current = value ?? "all";

  const handleChange = (next: string) => {
    onChange(next === "all" ? null : (next as TrainingType));
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Format
      </span>
      <Select value={current} onValueChange={handleChange}>
        <SelectTrigger
          aria-label="Filter trainings by format"
          className="h-9 w-[180px] rounded-full border-border/70 bg-card text-sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <span className="flex items-center gap-2">
              <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              All formats
            </span>
          </SelectItem>
          <SelectItem value="ELearning">
            <span className="flex items-center gap-2">
              <Laptop className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
              E-Learning
            </span>
          </SelectItem>
          <SelectItem value="OnSite">
            <span className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              In-Person
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
