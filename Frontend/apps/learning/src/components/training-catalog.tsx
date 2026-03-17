"use client";

import { useState, useMemo } from "react";
import { Input } from "@repo/ui";
import { Search } from "lucide-react";
import type { TrainingCategory, TrainingLevel, SortOption } from "@/types";
import type { TrainingCatalogProps } from "@/types/component-props";
import { TrainingCard } from "./training-card";
import { TrainingDetailDialog } from "./training-detail-dialog";
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
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<TrainingCategory | null>(null);
  const [level, setLevel] = useState<TrainingLevel | null>(null);
  const [sort, setSort] = useState<SortOption>("rating");
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);

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
    setSelectedTraining(training);
    setDialogOpen(true);
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
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-[hsl(var(--ey-yellow))]/5 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-6 py-12 lg:py-16">
          <div className="flex items-end gap-3 mb-1">
            <div className="flex h-9 w-1 rounded-full ey-bg-accent" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              EY Academy
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
            Training Catalog
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Explore our curated library of professional development programs.
            Filter by category, search by topic, and start building the skills
            that matter.
          </p>

          {/* Search */}
          <div className="relative mt-6 max-w-lg">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              aria-label="Search trainings"
              placeholder="Search trainings by title, topic, or tag…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 rounded-lg border-border/60 bg-[hsl(var(--ey-grey-50))] pl-10 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-[hsl(var(--ey-yellow))]"
            />
          </div>
        </div>
      </section>

      {/* Filters + Grid */}
      <section className="mx-auto max-w-7xl px-6 py-8">
        {/* Category chips */}
        <CategoryFilter selected={category} onChange={setCategory} />

        {/* Level filter */}
        <div className="mt-3">
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
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((training) => (
              <TrainingCard
                key={training.id}
                training={training}
                onSelect={handleSelect}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 py-20">
            <p className="text-sm font-medium text-muted-foreground">
              No trainings match your filters.
            </p>
            <button
              onClick={clearAll}
              className="mt-2 text-sm font-medium ey-text-link hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </section>

      {/* Detail dialog */}
      <TrainingDetailDialog
        training={selectedTraining}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
