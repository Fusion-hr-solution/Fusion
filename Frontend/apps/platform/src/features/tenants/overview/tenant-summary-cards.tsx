"use client";

import {
  Building2,
  CheckCircle2,
  Clock,
  Hourglass,
  Layers,
  ShieldCheck,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { cn } from "@repo/ds/lib/utils";
import type { OverviewFilter, TenantOverviewCounts } from "../api";

/**
 * The four lifecycle positions, as both the standing answer to "where does the
 * estate sit?" and the control that scopes the directory to one of them.
 *
 * They are the only lifecycle filter on the page: a second row of tabs saying
 * the same thing would make the operator choose between two identical controls.
 * Every number is counted by the service across the whole matching set, so a
 * card never describes only the visible page.
 *
 * Each card shares one structure — label, icon tile, count, metadata row — but
 * carries its own semantic tint, so the four read as a set without collapsing
 * into four copies of the same tile.
 */

interface Summary {
  filter: OverviewFilter;
  label: string;
  meaning: string;
  icon: LucideIcon;
  /** A second, smaller glyph for the metadata line. */
  meaningIcon: LucideIcon;
  /** The icon tile's tint. Reinforces the state; never the only carrier of it. */
  tile: string;
}

const SUMMARIES: Summary[] = [
  {
    filter: "All",
    label: "Total tenants",
    meaning: "All customer environments",
    icon: Building2,
    meaningIcon: Layers,
    // The platform's own accent: this is the whole estate, not a condition.
    tile: "bg-primary/15 text-primary",
  },
  {
    filter: "AwaitingActivation",
    label: "Awaiting activation",
    meaning: "Waiting for invited administrators",
    icon: Hourglass,
    meaningIcon: Clock,
    // Warm but neutral — waiting on a recipient is the ordinary path, not a
    // problem, so it stays quieter than the accent and the alert.
    tile: "bg-stone-500/15 text-stone-700 dark:bg-stone-400/15 dark:text-stone-300",
  },
  {
    filter: "Active",
    label: "Active",
    meaning: "Administrator access established",
    icon: CheckCircle2,
    meaningIcon: ShieldCheck,
    tile: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  {
    filter: "NeedsAttention",
    label: "Needs attention",
    meaning: "Invitation recovery required",
    icon: TriangleAlert,
    meaningIcon: Wrench,
    tile: "bg-destructive/15 text-destructive",
  },
];

const COUNT_KEY: Record<OverviewFilter, keyof TenantOverviewCounts> = {
  All: "all",
  AwaitingActivation: "awaitingActivation",
  Active: "active",
  NeedsAttention: "needsAttention",
};

export function TenantSummaryCards({
  counts,
  selected,
  isLoading,
  onSelect,
}: {
  counts: TenantOverviewCounts | null;
  selected: OverviewFilter;
  isLoading: boolean;
  onSelect: (filter: OverviewFilter) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filter tenants by lifecycle"
      className="mb-6 grid grid-cols-2 items-stretch gap-3 lg:grid-cols-4"
    >
      {SUMMARIES.map((summary) => (
        <SummaryCard
          key={summary.filter}
          summary={summary}
          count={counts?.[COUNT_KEY[summary.filter]] ?? null}
          isSelected={summary.filter === selected}
          isLoading={isLoading}
          onSelect={() => onSelect(summary.filter)}
        />
      ))}
    </div>
  );
}

function SummaryCard({
  summary,
  count,
  isSelected,
  isLoading,
  onSelect,
}: {
  summary: Summary;
  count: number | null;
  isSelected: boolean;
  isLoading: boolean;
  onSelect: () => void;
}) {
  const Icon = summary.icon;
  const MeaningIcon = summary.meaningIcon;
  // Attention earns emphasis only when there is something to attend to;
  // announcing that nothing is wrong every day would train the eye to skip it.
  const isRaised = summary.filter === "NeedsAttention" && (count ?? 0) > 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={cn(
        "group flex h-full flex-col rounded-2xl border p-[22px] text-left",
        "transition-[background-color,border-color,box-shadow] duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        isSelected
          ? // A decisive accent edge, doubled by an inner hairline so the
            // selection is a difference in weight and not only in hue. The
            // surface stays a faint wash: a heavier amber fill goes muddy over
            // the dark canvas.
            "border-primary bg-primary/[0.05] shadow-sm inset-ring-1 inset-ring-primary/40 dark:bg-primary/[0.07]"
          : // Unselected is deliberate, not dimmed: full card surface, real
            // border, and a hover that lifts rather than merely tints. The lift
            // is neutral on purpose — the accent belongs to selection, and an
            // amber hover would read as more selected than the selected card.
            "border-border bg-card shadow-xs hover:border-foreground/25 hover:bg-foreground/[0.03] hover:shadow-sm"
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {summary.label}
        </span>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
            summary.tile
          )}
        >
          <Icon aria-hidden="true" className="size-[18px]" />
        </span>
      </span>

      <span className="mt-4 block">
        {isLoading || count === null ? (
          // No placeholder digit: an invented number would be read as fact.
          <Skeleton className="h-9 w-14" />
        ) : (
          <span
            className={cn(
              "block text-4xl font-semibold leading-none tracking-tight tabular-nums",
              isRaised ? "text-destructive" : "text-foreground"
            )}
          >
            {count}
          </span>
        )}
      </span>

      <span className="mt-auto flex items-center gap-1.5 pt-5 text-xs text-muted-foreground">
        <MeaningIcon aria-hidden="true" className="size-3.5 shrink-0 opacity-70" />
        <span className="truncate">{summary.meaning}</span>
      </span>
    </button>
  );
}
