"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen } from "lucide-react";
import { PageHeader } from "./page-header";
import { SearchInput } from "./search-input";
import { EmptyState } from "./empty-state";
import type { TrainingCategory, TrainingLevel, SortOption, Training, TrainingType } from "@/types";
import type { TrainingCatalogProps } from "@/types/component-props";
import { TrainingCard } from "./training-card";
import { CategoryFilter } from "./category-filter";
import { LevelFilter } from "./level-filter";
import { SortSelect } from "./sort-select";
import { ActiveFilters } from "./active-filters";
import { CatalogPagination } from "./catalog-pagination";

function sortTrainings(trainings: Training[], sort: SortOption): Training[] {
  const parseDuration = (d: string) => parseInt(d.replace(/\D/g, ""));
  return [...trainings].sort((a, b) => {
    switch (sort) {
      case "rating": return b.rating - a.rating;
      case "newest": return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      case "enrolled": return b.enrolledCount - a.enrolledCount;
      case "duration": return parseDuration(a.duration) - parseDuration(b.duration);
    }
  });
}

export function TrainingCatalog({ trainings, totalCount, page, pageSize }: TrainingCatalogProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Search — local controlled input, debounced URL update (triggers server re-render)
  const urlSearch = searchParams.get("search") ?? "";
  const [inputSearch, setInputSearch] = useState(urlSearch);

  // Sync input when URL changes externally (back/forward navigation)
  useEffect(() => { setInputSearch(urlSearch); }, [urlSearch]);

  // Debounced search → URL update
  useEffect(() => {
    const timer = setTimeout(() => {
      const p = new URLSearchParams(searchParams.toString());
      if (inputSearch.trim()) p.set("search", inputSearch.trim());
      else p.delete("search");
      p.delete("page");
      router.replace(`?${p.toString()}`, { scroll: false });
    }, 400);
    return () => clearTimeout(timer);
  }, [inputSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Category — immediate URL update (server-side filtering across all pages)
  const urlCategory = (searchParams.get("category") ?? null) as TrainingCategory | null;

  const handleCategoryChange = useCallback(
    (cat: TrainingCategory | null) => {
      const p = new URLSearchParams(searchParams.toString());
      if (cat) p.set("category", cat);
      else p.delete("category");
      p.delete("page");
      router.replace(`?${p.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Level + sort — client-side only (backend doesn't expose a level filter)
  const [level, setLevel] = useState<TrainingLevel | null>(null);
  const [sort, setSort] = useState<SortOption>("rating");
  const [typeFilter, setTypeFilter] = useState<TrainingType | null>(null);

  // search + category are already applied server-side; only level is client-side
  const filtered = useMemo(() => {
    let result = trainings;
    if (level) result = result.filter((t) => t.level === level);
    if (typeFilter) result = result.filter((t) => t.trainingType === typeFilter);
    return sortTrainings(result, sort);
  }, [trainings, level, sort, typeFilter]);

  const clearAll = useCallback(() => {
    setLevel(null);
    setTypeFilter(null);
    setSort("rating");
    setInputSearch("");
    router.replace("?", { scroll: false });
  }, [router]);

  return (
    <>
      <PageHeader
        moduleTitle="Catalog"
        title="Training Catalog"
        description="Explore our curated library of professional development programs. Filter by category, search by topic, and start building the skills that matter."
      >
        <div
          className="ey-animate-fade-up mt-6"
          style={{ animationDelay: "200ms" }}
        >
          <SearchInput
            value={inputSearch}
            onChange={setInputSearch}
            placeholder="Search trainings by title, topic, or tag..."
            ariaLabel="Search trainings"
          />
        </div>
      </PageHeader>

      {/* Filters + Grid */}
      <section className="px-8 py-8">
        {/* Category chips */}
        <div className="ey-animate-fade-up" style={{ animationDelay: "280ms" }}>
          <CategoryFilter selected={urlCategory} onChange={handleCategoryChange} />
        </div>

        {/* Level filter */}
        <div className="mt-3 ey-animate-fade-up" style={{ animationDelay: "340ms" }}>
          <LevelFilter selected={level} onChange={setLevel} />
        </div>
        <div className="mt-3 ey-animate-fade-up flex gap-2" style={{ animationDelay: "380ms" }}>
          {(["all", "ELearning", "OnSite"] as const).map((t) => {
            const isActive = t === "all" ? typeFilter === null : typeFilter === t;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t === "all" ? null : t)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "ey-bg-dark text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {t === "all" ? "All Types" : t === "ELearning" ? "E-Learning" : "On-Site"}
              </button>
            );
          })}
        </div>

        {/* Active filters */}
        <div className="mt-4">
          <ActiveFilters
            category={urlCategory}
            level={level}
            search={inputSearch}
            onClearCategory={() => handleCategoryChange(null)}
            onClearLevel={() => setLevel(null)}
            onClearSearch={() => setInputSearch("")}
            onClearAll={clearAll}
          />
        </div>

        {/* Results count + sort */}
        <div className="mt-6 mb-5 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {filtered.length}
            </span>{" "}
            {filtered.length === 1 ? "training" : "trainings"} on this page
            {totalCount > pageSize && (
              <span className="ml-1 text-muted-foreground/70">(of {totalCount} total)</span>
            )}
          </p>
          <SortSelect value={sort} onChange={setSort} />
        </div>

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="ey-stagger-grid grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((training) => (
              <TrainingCard
                key={training.id}
                training={training}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="No trainings found"
            subtitle="Try adjusting your filters or search terms."
            action={
              <button
                onClick={clearAll}
                className="mt-4 rounded-lg ey-bg-dark px-4 py-2 text-xs font-semibold text-white transition-all hover:ey-bg-dark-deep hover:shadow-md"
              >
                Clear all filters
              </button>
            }
          />
        )}

        <CatalogPagination page={page} totalCount={totalCount} pageSize={pageSize} />
      </section>

    </>
  );
}
