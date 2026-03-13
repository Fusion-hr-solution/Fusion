"use client";

import type { TrainingCategory } from "@/types";
import type { CategoryFilterProps } from "@/types/component-props";
import { CATEGORY_CONFIG } from "@/data/categories";

const ALL_CATEGORIES = Object.keys(CATEGORY_CONFIG) as TrainingCategory[];

export function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onChange(null)}
        className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
          selected === null
            ? "ey-bg-dark border-transparent text-white"
            : "border-border bg-white text-muted-foreground hover:border-[hsl(var(--ey-grey-500))]/30 hover:text-foreground"
        }`}
      >
        All
      </button>
      {ALL_CATEGORIES.map((cat) => {
        const config = CATEGORY_CONFIG[cat];
        const isActive = selected === cat;
        return (
          <button
            key={cat}
            onClick={() => onChange(isActive ? null : cat)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
              isActive
                ? `border-transparent ${config.chipClass}`
                : "border-border bg-white text-muted-foreground hover:border-[hsl(var(--ey-grey-500))]/30 hover:text-foreground"
            }`}
          >
            {config.label}
          </button>
        );
      })}
    </div>
  );
}
