"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight, Landmark, Users } from "lucide-react";
import type { AlignmentTargetDto, PlanObjectiveDto } from "@repo/api";
import { Avatar, AvatarFallback } from "@repo/ds/components/ui/avatar";
import { ScopeMark } from "../scope-mark";
import { PlanBanner, PlanBannerMark } from "./plan-banner";
import { initials } from "./plan-lib";

export interface DirectionLevel {
  key: string;
  scope: string;
  title: string;
}

/**
 * The plan's context strip: the organizational direction it supports and the reviewer who holds its
 * agreement, resolved into one row. The employee's leading objective carries the emphasis (accent goal
 * mark, title) with its immediate parent objective named beneath it; the org-unit scopes it sits in
 * (its own focus area, and the objective it supports) read as quiet labelled facts, and the reviewer
 * closes the row. It is read-only context — one hop to Organization Goals for the full tree. With no
 * aligned objective there is no direction yet, so only the reviewer half renders.
 */
export function PlanDirection({
  objectives,
  targets,
  directionLevels,
  reviewerName,
  reviewerRole,
  canViewOrgGoals,
}: {
  objectives: PlanObjectiveDto[];
  targets: AlignmentTargetDto[];
  /** Explicit direction chain, deepest-first, overriding the objective-derived one (used before a
   *  plan exists, when direction is resolved from the employee's scoped alignment targets). */
  directionLevels?: DirectionLevel[];
  reviewerName?: string | null;
  reviewerRole?: string | null;
  canViewOrgGoals: boolean;
}) {
  const derived = useMemo(
    () => resolveDirection(objectives, targets),
    [objectives, targets]
  );
  const levels = directionLevels ?? derived;
  const leading = levels[0];
  const parent = levels[1];
  if (!leading && !reviewerName) return null;

  const reviewer = reviewerName ? (
    <div className="flex min-w-0 items-center gap-3 lg:border-l lg:border-border/60 lg:pl-6">
      <Avatar className="size-9">
        <AvatarFallback className="text-xs">
          {initials(reviewerName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="type-eyebrow whitespace-nowrap text-muted-foreground">
          Reviewer
        </p>
        <p className="truncate text-sm font-semibold text-foreground">
          {reviewerName}
        </p>
        {reviewerRole ? (
          <p className="truncate text-xs text-muted-foreground">
            {reviewerRole}
          </p>
        ) : null}
      </div>
    </div>
  ) : null;

  const goalsLink = canViewOrgGoals ? (
    <Link
      href="/goals"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:ml-auto"
    >
      View in Goals
      <ArrowUpRight className="size-3.5" aria-hidden />
    </Link>
  ) : null;

  // No aligned direction yet (e.g. before a plan exists): only the reviewer half. Same shell (surface,
  // radius, padding) as the full banner so heights stay in the same family, without a direction mark.
  if (!leading) {
    return (
      <section className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl border border-border bg-card px-4 py-3">
        {reviewer}
        {goalsLink}
      </section>
    );
  }

  return (
    <PlanBanner
      mark={
        <PlanBannerMark className="bg-primary/10 text-primary ring-primary/20">
          <ScopeMark className="size-7" />
        </PlanBannerMark>
      }
      title={leading.title}
      detail={parent?.title}
    >
      {/* Scopes: the objective's own focus area, and the objective it supports upward. */}
      <div className="flex items-center gap-x-6 lg:border-l lg:border-border/60 lg:pl-6">
        <ScopeFact
          icon={<Users className="size-5" aria-hidden />}
          label="Focus area"
          value={leading.scope}
        />
        {parent ? (
          <ScopeFact
            icon={<Landmark className="size-5" aria-hidden />}
            label="Supports"
            value={parent.scope}
          />
        ) : null}
      </div>
      {reviewer}
      {goalsLink}
    </PlanBanner>
  );
}

/** A quiet labelled scope: an outline icon beside an eyebrow and its single value. */
function ScopeFact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="shrink-0 text-muted-foreground/70">{icon}</span>
      <div className="min-w-0">
        <p className="type-eyebrow whitespace-nowrap text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}

/**
 * The plan's supported direction as a deepest-first chain of {scope, title}. Built from the longest
 * upstream path among the aligned objectives (the deepest connection the plan makes), with each
 * ancestor title matched to a published alignment target to recover its scope label.
 */
function resolveDirection(
  objectives: PlanObjectiveDto[],
  targets: AlignmentTargetDto[]
): DirectionLevel[] {
  const deepest = objectives
    .filter((o) => o.isAligned && o.directionPath.length > 0)
    .sort((a, b) => b.directionPath.length - a.directionPath.length)[0];
  if (!deepest) return [];

  const scopeByTitle = new Map<string, string>();
  for (const target of targets) {
    scopeByTitle.set(
      target.title,
      target.ownershipScope === "Company"
        ? "Company strategy"
        : (target.orgUnitName ?? "Organizational")
    );
  }

  // directionPath is top-down (company → nearest); reverse so the employee's own level leads.
  return deepest.directionPath
    .map((title, index) => ({
      key: `${index}-${title}`,
      scope: scopeByTitle.get(title) ?? "Direction",
      title,
    }))
    .reverse();
}

/**
 * The direction an employee will plan against before any objective exists: the published objective
 * owned at their own org unit leads (their focus area), with its nearest parent named as what it
 * supports. Falls back to the deepest published objective when no target matches their unit. This
 * mirrors what {@link resolveDirection} recovers from a plan's aligned objectives.
 */
export function directionFromTargets(
  targets: AlignmentTargetDto[],
  orgUnitName: string | null | undefined
): DirectionLevel[] {
  if (targets.length === 0) return [];

  const scopeLabel = (t: AlignmentTargetDto) =>
    t.ownershipScope === "Company"
      ? "Company strategy"
      : (t.orgUnitName ?? "Organizational");
  const scopeByTitle = new Map<string, string>();
  for (const t of targets) scopeByTitle.set(t.title, scopeLabel(t));

  const own = orgUnitName
    ? targets.find((t) => t.orgUnitName === orgUnitName)
    : undefined;
  const leading =
    own ??
    [...targets].sort(
      (a, b) => b.directionPath.length - a.directionPath.length
    )[0];
  if (!leading) return [];

  const levels: DirectionLevel[] = [
    {
      key: `own-${leading.id}`,
      scope: scopeLabel(leading),
      title: leading.title,
    },
  ];
  const parentTitle = leading.directionPath.at(-1);
  if (parentTitle) {
    levels.push({
      key: `parent-${parentTitle}`,
      scope: scopeByTitle.get(parentTitle) ?? "Direction",
      title: parentTitle,
    });
  }
  return levels;
}
