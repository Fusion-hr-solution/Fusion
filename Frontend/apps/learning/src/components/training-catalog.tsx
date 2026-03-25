"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";
import { PageHeader } from "./page-header";
import { SearchInput } from "./search-input";
import { EmptyState } from "./empty-state";
import type { TrainingCategory, TrainingLevel, SortOption } from "@/types";
import type { TrainingCatalogProps } from "@/types/component-props";
import { TrainingCard } from "./training-card";
import { CategoryFilter } from "./category-filter";
import { LevelFilter } from "./level-filter";
import { SortSelect } from "./sort-select";
import { ActiveFilters } from "./active-filters";
import type { Training } from "@/types";

function parseDuration(d: string): number {
  return parseInt(d.replace(/\D/g, ""));
}

function sortTrainings(trainings: Training[], sort: SortOption): Training[] {
  return [...trainings].sort((a, b) => {
    switch (sort) {
      case "rating":
        return b.rating - a.rating;
      case "newest":
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      case "enrolled":
        return b.enrolledCount - a.enrolledCount;
      case "duration":
        return parseDuration(a.duration) - parseDuration(b.duration);
    }
  });
}

export function TrainingCatalog({ trainings }: TrainingCatalogProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<TrainingCategory | null>(null);
  const [level, setLevel] = useState<TrainingLevel | null>(null);
  const [sort, setSort] = useState<SortOption>("rating");

  const filtered = useMemo(() => {
    let result = trainings;

    if (category) {
      result = result.filter((t) => t.category === category);
    }

    if (level) {
      result = result.filter((t) => t.level === level);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    return sortTrainings(result, sort);
  }, [trainings, category, level, search, sort]);

  const handleSelect = (training: Training) => {
    router.push(`/training/${training.id}`);
  };

  const clearAll = () => {
    setSearch("");
    setCategory(null);
    setLevel(null);
  };

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
            value={search}
            onChange={setSearch}
            placeholder="Search trainings by title, topic, or tag..."
            ariaLabel="Search trainings"
          />
        </div>
      </PageHeader>

      {/* Filters + Grid */}
      <section className="px-8 py-8">
        {/* Category chips */}
        <div className="ey-animate-fade-up" style={{ animationDelay: "280ms" }}>
          <CategoryFilter selected={category} onChange={setCategory} />
        </div>

        {/* Level filter */}
        <div className="mt-3 ey-animate-fade-up" style={{ animationDelay: "340ms" }}>
          <LevelFilter selected={level} onChange={setLevel} />
        </div>

        {/* Active filters */}
        <div className="mt-4">
          <ActiveFilters
            category={category}
            level={level}
            search={search}
            onClearCategory={() => setCategory(null)}
            onClearLevel={() => setLevel(null)}
            onClearSearch={() => setSearch("")}
            onClearAll={clearAll}
          />
        </div>

        {/* Results count + sort */}
        <div className="mt-6 mb-5 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {filtered.length}
            </span>{" "}
            {filtered.length === 1 ? "training" : "trainings"} available
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
                onSelect={handleSelect}
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
      </section>

    </>
  );
}
