"use client";

import { ArrowUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SortSelectProps } from "@/types/component-props";
import type { SortOption } from "@/types";
import { SORT_OPTIONS } from "@/data/sort-options";

export function SortSelect({ value, onChange }: SortSelectProps) {
  const t = useTranslations("catalog.sort");
  const tCommon = useTranslations("common");
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-2.5 py-1 shadow-sm transition-all hover:border-border">
      <ArrowUpDown
        className="h-3.5 w-3.5 text-muted-foreground"
        aria-hidden="true"
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        aria-label={t("aria")}
        className="appearance-none bg-transparent py-0.5 text-xs font-medium text-foreground outline-none cursor-pointer"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {tCommon(`sort.${opt.value}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
