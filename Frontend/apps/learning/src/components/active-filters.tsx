"use client";

import { X, Filter } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("catalog.filters");
  const tCommon = useTranslations("common");
  const hasFilters = category || level || search.trim();
  if (!hasFilters) return null;

  return (
    <div className="ey-animate-fade-in flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Filter className="h-3 w-3" aria-hidden="true" />
        {t("active")}
      </span>

      {category && (
        <button
          onClick={onClearCategory}
          aria-label={t("removeFilterAria", { filter: tCommon(`category.${category}`) })}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all hover:shadow-sm hover:opacity-80 ${CATEGORY_CONFIG[category].badgeClass}`}
        >
          {tCommon(`category.${category}`)}
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}

      {level && (
        <button
          onClick={onClearLevel}
          aria-label={t("removeFilterAria", { filter: tCommon(`level.${level}`) })}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-0.5 text-xs font-medium text-foreground transition-all hover:bg-muted hover:shadow-sm"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${LEVEL_CONFIG[level].dotClass}`}
          />
          {tCommon(`level.${level}`)}
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}

      {search.trim() && (
        <button
          onClick={onClearSearch}
          aria-label={t("removeSearchAria")}
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
        {t("clearAll")}
      </button>
    </div>
  );
}
