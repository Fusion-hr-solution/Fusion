"use client";

import { useQuery } from "@tanstack/react-query";
import { DEFAULT_TAXONOMY, type TaxonomyListKey } from "@/config/taxonomy";
import { getTaxonomy } from "@/services/taxonomy-service";

export const TAXONOMY_QUERY_KEY = ["interview-taxonomy"] as const;

/**
 * The admin-curated dropdown lists.
 *
 * `placeholderData` is doing two jobs at once, and both are requirements rather than polish:
 *   - **No loading flash.** The first render already has full option lists, so a `<select>` is
 *     never momentarily empty and never shows a skeleton.
 *   - **Safe degradation.** If the request fails, `data` stays on the canonical defaults
 *     permanently instead of collapsing to `undefined`, so authoring keeps working offline.
 *
 * React Query dedupes by key, so every consumer shares one request with no provider plumbing.
 * `refetchOnWindowFocus` is off deliberately: without it, alt-tabbing could reorder an open
 * dropdown under the user's cursor.
 */
export function useTaxonomy() {
  const query = useQuery({
    queryKey: TAXONOMY_QUERY_KEY,
    queryFn: getTaxonomy,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: DEFAULT_TAXONOMY,
  });

  return {
    taxonomy: query.data ?? DEFAULT_TAXONOMY,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export interface TaxonomyOption {
  value: string;
  label: string;
}

/**
 * Visible options for a list, in the admin's order.
 *
 * `ensureValue` keeps a record's current value selectable even after it has been hidden or deleted.
 * **Every edit surface must pass it; create and filter surfaces must not.** Without it, opening a
 * question whose language was removed shows an empty select, and saving writes an empty string —
 * silent data loss of exactly the kind that turned Frontend Project questions into Essays.
 */
export function useTaxonomyOptions(
  key: TaxonomyListKey,
  options?: { ensureValue?: string | null }
): TaxonomyOption[] {
  const { taxonomy } = useTaxonomy();
  const items = taxonomy.lists[key]?.items ?? [];

  const visible: TaxonomyOption[] = items
    .filter((item) => !item.hidden)
    .map((item) => ({ value: item.value, label: item.label }));

  const ensure = options?.ensureValue?.trim();
  if (!ensure || visible.some((option) => option.value === ensure)) {
    return visible;
  }

  const retired = items.find((item) => item.value === ensure);
  return [{ value: ensure, label: `${retired?.label ?? ensure} (retired)` }, ...visible];
}

/** Resolves a wire value to its admin-facing label, for badges and summaries. */
export function useTaxonomyLabel(key: TaxonomyListKey): (value: string) => string {
  const { taxonomy } = useTaxonomy();
  const items = taxonomy.lists[key]?.items ?? [];
  return (value: string) => items.find((item) => item.value === value)?.label ?? value;
}
