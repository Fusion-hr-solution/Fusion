"use client";

import { ArrowUpDown } from "lucide-react";
import type { SortSelectProps } from "@/types/component-props";
import type { SortOption } from "@/types";
import { SORT_OPTIONS } from "@/data/sort-options";

export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <div className="flex items-center gap-2">
      <ArrowUpDown
        className="h-3.5 w-3.5 text-muted-foreground"
        aria-hidden="true"
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        aria-label="Sort trainings"
        className="rounded-md border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-foreground outline-none transition-colors focus:ring-1 focus:ring-[hsl(var(--ey-yellow))]"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
