"use client";

import { ArrowUpDown } from "lucide-react";
import type { SortSelectProps } from "@/types/component-props";
import type { SortOption } from "@/types";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "rating", label: "Highest Rated" },
  { value: "newest", label: "Newest First" },
  { value: "enrolled", label: "Most Enrolled" },
  { value: "duration", label: "Shortest First" },
];

export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <div className="flex items-center gap-2">
      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className="rounded-md border border-border bg-white px-2.5 py-1.5 text-[12px] font-medium text-foreground outline-none transition-colors focus:ring-1 focus:ring-[hsl(var(--ey-yellow))]"
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
