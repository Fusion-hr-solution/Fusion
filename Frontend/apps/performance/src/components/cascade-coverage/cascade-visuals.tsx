"use client";

import { type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { initials } from "@/lib/labels";
import { cn } from "@/lib/utils";

/**
 * Shared visual language for the two cascade surfaces (Direction's read-only Strategy view and
 * the manager's Team-objective workspace). Everything here is presentational: text comes from the
 * caller so terminology stays in one source.
 *
 * The signature is a *coverage board*: strategic objectives are dense, glanceable rows that
 * collapse the wall of team objectives away by default and open on demand. A gap (uncovered)
 * objective is washed gold so it can never hide inside a long list. Coverage is read at a glance
 * from the segmented cascade bar up top — one segment per strategic objective.
 */

/** Emerald = covered, matched to CHART_TONES.success; gold gap uses the brand primary. */
export const COVERED_COLOR = "oklch(0.696 0.17 162.48)";
const GAP_COLOR = "var(--primary)";

// ── Segmented cascade bar + coverage banner ──────────────────────────────────

/**
 * The coverage map: one segment per strategic objective, emerald when covered and gold when a
 * gap. Reads left-to-right as a literal picture of the board below. Falls back to a proportion
 * bar past ~18 objectives, where individual segments would be too thin to read.
 */
export function SegmentedCoverageBar({
  segments,
  className,
}: {
  segments: boolean[];
  className?: string;
}) {
  const total = segments.length;
  const covered = segments.filter(Boolean).length;

  if (total === 0) {
    return (
      <div className={cn("h-2.5 w-full rounded-full bg-border", className)} />
    );
  }

  if (total > 18) {
    return (
      <div
        className={cn("h-2.5 w-full overflow-hidden rounded-full", className)}
        style={{ background: GAP_COLOR }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${(covered / total) * 100}%`,
            background: COVERED_COLOR,
          }}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)} aria-hidden>
      {segments.map((isCovered, index) => (
        <span
          key={index}
          className="h-2.5 flex-1 rounded-full"
          style={{ background: isCovered ? COVERED_COLOR : GAP_COLOR }}
        />
      ))}
    </div>
  );
}

export interface CoverageStat {
  value: string;
  label: string;
}

/**
 * The diagnostic headline: a large covered/total numeral, the segmented cascade map, and
 * secondary stats with real weight. Deliberately not a donut — the segmented map is more
 * characterful and, unlike a ring, shows *which* objectives are the gaps.
 */
export function CoverageBanner({
  covered,
  total,
  coveredLabel,
  segments,
  coveredLegend,
  gapLegend,
  stats,
}: {
  covered: number;
  total: number;
  coveredLabel: string;
  segments: boolean[];
  coveredLegend: string;
  gapLegend: string;
  stats: CoverageStat[];
}) {
  const hasGap = segments.some((s) => !s);

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border bg-card px-6 py-5 sm:flex-row sm:items-center sm:gap-8">
      <div className="flex items-center gap-4 sm:w-52 sm:shrink-0">
        <p className="font-heading text-[3.25rem] font-semibold leading-none tracking-tight tabular-nums text-foreground">
          {covered}
          <span className="text-3xl text-muted-foreground">/{total}</span>
        </p>
        <p className="text-sm font-medium leading-tight text-muted-foreground">
          {coveredLabel}
        </p>
      </div>

      <div className="min-w-0 flex-1">
        <SegmentedCoverageBar segments={segments} />
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ background: COVERED_COLOR }}
            />
            {coveredLegend}
          </span>
          {hasGap ? (
            <span className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: GAP_COLOR }}
              />
              {gapLegend}
            </span>
          ) : null}
        </div>
      </div>

      {stats.length > 0 ? (
        <div className="flex gap-8 sm:shrink-0 sm:border-l sm:border-border sm:pl-8">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="font-heading text-2xl font-semibold leading-none tabular-nums tracking-tight text-foreground">
                {stat.value}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Cascade row: a collapsible strategic-objective lane ───────────────────────

/**
 * One strategic objective as a dense, glanceable row that collapses its team objectives away by
 * default and reveals them on demand — the move that kills the scroll wall. A gap lane is washed
 * gold. When `collapsible` is false (a read-only gap with nothing to open) the row renders as a
 * static header with no chevron.
 */
export function CascadeRow({
  covered,
  defaultOpen = false,
  collapsible = true,
  title,
  description,
  functionLabel,
  status,
  cluster,
  actions,
  children,
}: {
  covered: boolean;
  defaultOpen?: boolean;
  collapsible?: boolean;
  title: string;
  description?: string | null;
  functionLabel?: string | null;
  /** The coverage StatusBadge (count / needs-objective). */
  status: ReactNode;
  /** Contributing people as an avatar cluster (strategy view). */
  cluster?: ReactNode;
  /** Actions rendered beside the trigger, never inside it (avoids nested buttons). */
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const laneClass = cn(
    "group/row overflow-hidden rounded-xl border bg-card",
    covered ? "border-border" : "border-primary/30 bg-primary/[0.035]"
  );

  const head = (
    <>
      <span aria-hidden className="relative w-6 shrink-0 self-stretch">
        <span
          className="absolute left-3 top-[1.4rem] size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: covered ? COVERED_COLOR : GAP_COLOR }}
        />
        {collapsible ? (
          <span className="absolute bottom-0 left-3 top-[1.4rem] hidden w-px -translate-x-1/2 bg-border group-data-[state=open]/row:block" />
        ) : null}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-2">
          <span className="min-w-0 flex-1">
            <span className="block font-heading text-base font-semibold tracking-tight text-foreground">
              {title}
            </span>
            {description ? (
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {description}
              </span>
            ) : null}
          </span>
          {collapsible ? (
            <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/row:rotate-90 motion-reduce:transition-none" />
          ) : null}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {status}
          {functionLabel ? (
            <Badge variant="outline">{functionLabel}</Badge>
          ) : null}
          {cluster}
        </span>
      </span>
    </>
  );

  const headerPad = cn(
    "flex gap-2 px-4 py-3 text-left",
    covered ? "bg-muted/40" : "bg-primary/[0.06]"
  );

  if (!collapsible) {
    return (
      <section className={laneClass}>
        <div className={headerPad}>{head}</div>
      </section>
    );
  }

  return (
    <Collapsible defaultOpen={defaultOpen} asChild>
      <section className={laneClass}>
        <div className="flex items-stretch">
          <CollapsibleTrigger
            className={cn(
              headerPad,
              "min-w-0 flex-1 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              !covered && "hover:bg-primary/[0.09]"
            )}
          >
            {head}
          </CollapsibleTrigger>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2 px-4 py-3">
              {actions}
            </div>
          ) : null}
        </div>
        <CollapsibleContent className="overflow-hidden">
          {children}
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

/** One leaf hanging off the spine. `last` ends the vertical rail at this node. */
export function Leaf({
  last,
  children,
}: {
  last: boolean;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-2 px-4">
      <BranchGutter last={last} />
      <div className="flex min-w-0 flex-1 items-start justify-between gap-3 py-3">
        {children}
      </div>
    </li>
  );
}

/** A single terminal branch used for the gap/empty state (an inviting add call). */
export function LaneEmptyBranch({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 px-4 pb-1">
      <BranchGutter last />
      <div className="min-w-0 flex-1 py-2.5">{children}</div>
    </div>
  );
}

/** The tree connector for a leaf: a continuous vertical rail plus an elbow to the content. */
function BranchGutter({ last }: { last: boolean }) {
  return (
    <div aria-hidden className="relative w-6 shrink-0 self-stretch">
      <span
        className={cn(
          "absolute left-3 top-0 w-px -translate-x-1/2 bg-border",
          last ? "h-[1.375rem]" : "bottom-0"
        )}
      />
      <span className="absolute left-3 top-[1.375rem] h-px w-2.5 bg-border" />
    </div>
  );
}

/**
 * The objective statement + "success looks like" + a meta row (how it's measured, and who owns
 * it). Keeping measurement and owner in the anatomy — not as a top-right badge — lets the title
 * use the full width and makes a leaf read unmistakably as an objective.
 */
export function LeafBody({
  title,
  successLabel,
  successCriteria,
  description,
  measurementLabel,
  ownerName,
}: {
  title: string;
  successLabel: string;
  successCriteria: string;
  description?: string | null;
  measurementLabel?: string;
  ownerName?: string;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        <span className="font-medium text-foreground/70">{successLabel} </span>
        {successCriteria}
      </p>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground/80">{description}</p>
      ) : null}
      {measurementLabel || ownerName ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {measurementLabel ? (
            <Badge variant="secondary">{measurementLabel}</Badge>
          ) : null}
          {ownerName ? <PersonChip name={ownerName} /> : null}
        </div>
      ) : null}
    </div>
  );
}

// ── People: monograms and clusters, not shopping lists ───────────────────────

/** An avatar monogram; contributors get a brand-tinted fill, silent people stay muted. */
export function PersonMonogram({
  name,
  active,
  size = "sm",
}: {
  name: string;
  active?: boolean;
  size?: "sm" | "default";
}) {
  return (
    <Avatar size={size}>
      <AvatarFallback
        className={cn(
          active ? "bg-primary/15 font-medium text-primary" : undefined
        )}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

/**
 * A cluster of contributing people as overlapping monograms + an overflow count. Replaces the
 * per-lane "shopping list" of manager names with a compact, face-first signal of who cascaded.
 */
export function AvatarCluster({
  names,
  max = 4,
  size = "sm",
}: {
  names: string[];
  max?: number;
  size?: "sm" | "default";
}) {
  if (names.length === 0) {
    return null;
  }
  const shown = names.slice(0, max);
  const overflow = names.length - shown.length;

  return (
    <AvatarGroup className="items-center">
      {shown.map((name, index) => (
        <Avatar key={`${name}-${index}`} size={size}>
          <AvatarFallback className="text-[10px] font-medium">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 ? (
        <AvatarGroupCount className={cn(size === "sm" && "size-6 text-[10px]")}>
          +{overflow}
        </AvatarGroupCount>
      ) : null}
    </AvatarGroup>
  );
}

/** Inline monogram + name, for attributing a team objective to its owner. */
export function PersonChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Avatar size="sm" className="size-5">
        <AvatarFallback className="text-[10px]">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <span className="truncate font-medium text-foreground/80">{name}</span>
    </span>
  );
}

/** A person as a row: monogram, name, a secondary line, and a trailing metric. */
export function PersonRow({
  name,
  secondary,
  trailing,
  active,
}: {
  name: string;
  secondary?: string;
  trailing?: ReactNode;
  active?: boolean;
}) {
  return (
    <li className="flex items-center gap-2.5">
      <div className="relative">
        <PersonMonogram name={name} active={active} />
        {active === false ? (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary ring-2 ring-card"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        {secondary ? (
          <p className="truncate text-xs text-muted-foreground">{secondary}</p>
        ) : null}
      </div>
      {trailing}
    </li>
  );
}
