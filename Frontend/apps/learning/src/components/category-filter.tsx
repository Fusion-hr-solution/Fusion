"use client";

import type { TrainingCategory } from "@/types";
import { CATEGORY_CONFIG } from "@/data/categories";

const ALL_CATEGORIES = Object.keys(CATEGORY_CONFIG) as TrainingCategory[];

interface CategoryFilterProps {
  selected: TrainingCategory | null;
  onChange: (category: TrainingCategory | null) => void;
}

export function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onChange(null)}
        className={`rounded-full border px-4 py-1.5 text-[13px] font-medium transition-all ${
          selected === null
            ? "border-[#2E2E38] bg-[#2E2E38] text-white"
            : "border-border bg-white text-muted-foreground hover:border-[#2E2E38]/30 hover:text-foreground"
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
            className={`rounded-full border px-4 py-1.5 text-[13px] font-medium transition-all ${
              isActive
                ? `border-transparent text-white`
                : "border-border bg-white text-muted-foreground hover:border-[#2E2E38]/30 hover:text-foreground"
            }`}
            style={isActive ? { backgroundColor: config.color, color: cat === "leadership" ? "#2E2E38" : "#fff" } : undefined}
          >
            {config.label}
          </button>
        );
      })}
    </div>
  );
}
