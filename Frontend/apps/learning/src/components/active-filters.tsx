"use client";

import { X } from "lucide-react";
import type { ActiveFiltersProps } from "@/types/component-props";
import { CATEGORY_CONFIG, LEVEL_CONFIG } from "@/data/categories";

export function ActiveFilters({
  category,
  level,
  search,
  onClearCategory,
  onClearLevel,
  onClearSearch,
  onClearAll,
}: ActiveFiltersProps) {
  const hasFilters = category || level || search.trim();
  if (!hasFilters) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Active:
      </span>

      {category && (
        <button
          onClick={onClearCategory}
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors hover:opacity-80 ${CATEGORY_CONFIG[category].badgeClass}`}
        >
          {CATEGORY_CONFIG[category].label}
          <X className="h-3 w-3" />
        </button>
      )}

      {level && (
        <button
          onClick={onClearLevel}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-[hsl(var(--ey-grey-100))]"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${LEVEL_CONFIG[level].dotClass}`}
          />
          {LEVEL_CONFIG[level].label}
          <X className="h-3 w-3" />
        </button>
      )}

      {search.trim() && (
        <button
          onClick={onClearSearch}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-[hsl(var(--ey-grey-100))]"
        >
          &ldquo;{search}&rdquo;
          <X className="h-3 w-3" />
        </button>
      )}

      <button
        onClick={onClearAll}
        className="text-[11px] font-medium ey-text-link hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}
