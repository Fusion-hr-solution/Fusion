"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@repo/ui";
import { Search, BookOpen } from "lucide-react";
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
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/50 bg-white">
        {/* Geometric background accents */}
        <div className="absolute right-0 top-0 h-full w-2/5 bg-gradient-to-l from-[hsl(var(--ey-yellow))]/5 to-transparent" />
        <div className="ey-hero-pattern absolute inset-0 opacity-40" />
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full border-2 border-[hsl(var(--ey-yellow))]/10" />
        <div className="absolute right-20 bottom-4 h-24 w-24 rounded-full border-2 border-[hsl(var(--ey-yellow))]/8" />

        <div className="relative px-8 py-12 lg:py-16">
          <div className="ey-animate-fade-up flex items-end gap-3 mb-1">
            <div className="flex h-9 w-1 rounded-full ey-bg-accent" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              EY Academy
            </span>
          </div>

          <div className="mt-3">
              <h1
                className="ey-animate-fade-up text-3xl font-bold tracking-tight text-foreground lg:text-4xl"
                style={{ animationDelay: "80ms" }}
              >
                Training Catalog
              </h1>
              <p
                className="ey-animate-fade-up mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground"
                style={{ animationDelay: "160ms" }}
              >
                Explore our curated library of professional development programs.
                Filter by category, search by topic, and start building the skills
                that matter.
              </p>
          </div>

          {/* Search */}
          <div
            className="ey-animate-fade-up relative mt-6 max-w-lg"
            style={{ animationDelay: "200ms" }}
          >
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              aria-label="Search trainings"
              placeholder="Search trainings by title, topic, or tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 rounded-lg border-border/60 bg-[hsl(var(--ey-grey-50))] pl-10 text-sm shadow-sm placeholder:text-muted-foreground/60 focus-visible:ring-[hsl(var(--ey-yellow))] focus-visible:border-[hsl(var(--ey-yellow))]/40 transition-shadow focus-visible:shadow-[0_0_0_3px_hsl(var(--ey-yellow)/0.1)]"
            />
          </div>
        </div>
      </section>

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
          <div className="ey-animate-scale-in flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-white py-20">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--ey-grey-100))] mb-4">
              <BookOpen className="h-6 w-6 text-muted-foreground/50" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              No trainings found
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try adjusting your filters or search terms.
            </p>
            <button
              onClick={clearAll}
              className="mt-4 rounded-lg ey-bg-dark px-4 py-2 text-xs font-semibold text-white transition-all hover:ey-bg-dark-deep hover:shadow-md"
            >
              Clear all filters
            </button>
          </div>
        )}
      </section>

    </>
  );
}
