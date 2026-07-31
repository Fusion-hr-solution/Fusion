"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookOpen, Sparkles } from "lucide-react";
import type { TrainingCategory, TrainingLevel, SortOption, TrainingType } from "@/types";
import type { TrainingCatalogProps } from "@/types/component-props";
import { PageHeader } from "./page-header";
import { SearchInput } from "./search-input";
import { EmptyState } from "./empty-state";
import { TrainingCard } from "./training-card";
import { CategoryFilter } from "./category-filter";
import { LevelFilter } from "./level-filter";
import { SortSelect } from "./sort-select";
import { ActiveFilters } from "./active-filters";
import { CatalogPagination } from "./catalog-pagination";
import { FormatFilter } from "./format-filter";
import { sortTrainings } from "./catalog-helpers";

export function TrainingCatalog({ trainings, totalCount, page, pageSize, semanticMode = false }: TrainingCatalogProps) {
  const t = useTranslations("catalog");
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlSearch = searchParams.get("search") ?? "";
  const [inputSearch, setInputSearch] = useState(urlSearch);
  useEffect(() => { setInputSearch(urlSearch); }, [urlSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const p = new URLSearchParams(searchParams.toString());
      if (inputSearch.trim()) p.set("search", inputSearch.trim()); else p.delete("search");
      p.delete("page");
      router.replace(`?${p.toString()}`, { scroll: false });
    }, 400);
    return () => clearTimeout(timer);
  }, [inputSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const urlCategory = (searchParams.get("category") ?? null) as TrainingCategory | null;
  const handleCategoryChange = useCallback((cat: TrainingCategory | null) => {
    const p = new URLSearchParams(searchParams.toString());
    if (cat) p.set("category", cat); else p.delete("category");
    p.delete("page");
    router.replace(`?${p.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const [level, setLevel] = useState<TrainingLevel | null>(null);
  const [sort, setSort] = useState<SortOption>("rating");

  const urlTrainingType =
    searchParams.get("trainingType") === "ELearning" || searchParams.get("trainingType") === "OnSite"
      ? (searchParams.get("trainingType") as TrainingType)
      : null;

  const handleTrainingTypeChange = useCallback(
    (next: TrainingType | null) => {
      const p = new URLSearchParams(searchParams.toString());
      if (next) p.set("trainingType", next);
      else p.delete("trainingType");
      p.delete("page");
      router.replace(`?${p.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const filtered = useMemo(() => {
    let result = trainings;
    if (level) result = result.filter((t) => t.level === level);
    // Semantic mode: preserve the endpoint's relevance ranking (level still filters client-side).
    return semanticMode ? result : sortTrainings(result, sort);
  }, [trainings, level, sort, semanticMode]);

  const clearAll = useCallback(() => {
    setLevel(null); setSort("rating"); setInputSearch("");
    router.replace("?", { scroll: false });
  }, [router]);

  return (
    <>
      <PageHeader moduleTitle={t("header.moduleTitle")} title={t("header.title")} description={t("header.description")}>
        <div className="ey-animate-fade-up mt-6" style={{ animationDelay: "200ms" }}>
          <SearchInput value={inputSearch} onChange={setInputSearch} placeholder={t("search.placeholder")} ariaLabel={t("search.aria")} />
        </div>
      </PageHeader>

      <section className="px-8 py-8">
        <div className="ey-animate-fade-up" style={{ animationDelay: "280ms" }}><CategoryFilter selected={urlCategory} onChange={handleCategoryChange} /></div>
        <div className="mt-3 ey-animate-fade-up" style={{ animationDelay: "340ms" }}><LevelFilter selected={level} onChange={setLevel} /></div>
        <div className="mt-3 ey-animate-fade-up" style={{ animationDelay: "380ms" }}>
          <FormatFilter value={urlTrainingType} onChange={handleTrainingTypeChange} />
        </div>

        <div className="mt-4">
          <ActiveFilters category={urlCategory} level={level} search={inputSearch} onClearCategory={() => handleCategoryChange(null)} onClearLevel={() => setLevel(null)} onClearSearch={() => setInputSearch("")} onClearAll={clearAll} />
        </div>

        {semanticMode && filtered.length > 0 && (
          <div className="ey-animate-fade-up mt-5 flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/40 px-3.5 py-2.5" role="status">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 ey-text-accent" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-muted-foreground">{t("semantic.note")}</p>
          </div>
        )}

        <div className="mt-6 mb-5 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{filtered.length}</span>{" "}
            {semanticMode
              ? t("results.related", { count: filtered.length })
              : t("results.onPage", { count: filtered.length })}
            {!semanticMode && totalCount > pageSize && (
              <span className="ml-1 text-muted-foreground/70">{t("results.ofTotal", { total: totalCount })}</span>
            )}
          </p>
          <SortSelect value={sort} onChange={setSort} relevanceMode={semanticMode} />
        </div>

        {filtered.length > 0 ? (
          <div className="ey-stagger-grid grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((training) => <TrainingCard key={training.id} training={training} />)}
          </div>
        ) : (
          <EmptyState icon={BookOpen} title={t("empty.title")} subtitle={t("empty.subtitle")}
            action={<button onClick={clearAll} className="mt-4 rounded-lg ey-bg-dark px-4 py-2 text-xs font-semibold text-white transition-all hover:ey-bg-dark-deep hover:shadow-md">{t("empty.clearFilters")}</button>} />
        )}

        {!semanticMode && <CatalogPagination page={page} totalCount={totalCount} pageSize={pageSize} />}
      </section>
    </>
  );
}
