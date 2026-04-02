"use client";

import { X, Filter } from "lucide-react";
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
    <div className="ey-animate-fade-in flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Filter className="h-3 w-3" aria-hidden="true" />
        Active:
      </span>

      {category && (
        <button
          onClick={onClearCategory}
          aria-label={`Remove ${CATEGORY_CONFIG[category].label} filter`}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all hover:shadow-sm hover:opacity-80 ${CATEGORY_CONFIG[category].badgeClass}`}
        >
          {CATEGORY_CONFIG[category].label}
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}

      {level && (
        <button
          onClick={onClearLevel}
          aria-label={`Remove ${LEVEL_CONFIG[level].label} filter`}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-0.5 text-xs font-medium text-foreground transition-all hover:bg-muted hover:shadow-sm"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${LEVEL_CONFIG[level].dotClass}`}
          />
          {LEVEL_CONFIG[level].label}
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}

      {search.trim() && (
        <button
          onClick={onClearSearch}
          aria-label="Remove search filter"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-0.5 text-xs font-medium text-foreground transition-all hover:bg-muted hover:shadow-sm"
        >
          &ldquo;{search}&rdquo;
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}

      <button
        onClick={onClearAll}
        className="text-xs font-semibold ey-text-link transition-colors hover:text-[hsl(var(--ey-blue-400))] hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}
