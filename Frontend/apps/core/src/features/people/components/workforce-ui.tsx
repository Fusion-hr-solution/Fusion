"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@repo/ds";
import { StatusBadge, type StatusTone } from "@repo/ds/shell";
import type { PeopleEmploymentState } from "@repo/api";

/**
 * Workforce-local composition grammar for Slice 1 People surfaces.
 *
 * These are Core/Workforce product patterns — a compact human identity, an
 * Organization path treatment, and workforce status/date language — reused
 * across the roster, pickers, review, profile, and direct reports. HR semantics
 * stay here and never leak into `@repo/ds`.
 */

const STATE_TONE: Record<PeopleEmploymentState, StatusTone> = {
  Active: "success",
  Scheduled: "info",
  Former: "muted",
  Incomplete: "warning",
};

type MonogramSize = "sm" | "md" | "lg" | "xl";

const MONOGRAM_SIZE: Record<MonogramSize, string> = {
  sm: "size-8 text-[0.6875rem]",
  md: "size-9 text-xs",
  lg: "size-11 text-sm",
  xl: "size-16 text-xl",
};

/** Two-letter monogram derived from the display name — deterministic, never random. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts.at(-1)![0]!).toUpperCase();
}

/**
 * Restrained monogram tile. A squared, `lg`-radius tile rather than a circular
 * SaaS avatar — structured, quiet, and identical in tone for everyone (no
 * per-person color). Gives a person visible human presence without decoration.
 */
export function Monogram({
  name,
  size = "md",
  accent = false,
  className,
}: {
  name: string;
  size?: MonogramSize;
  accent?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-[0.625rem] font-semibold tracking-tight tabular-nums",
        accent
          ? "bg-primary/12 text-foreground ring-1 ring-inset ring-primary/25"
          : "bg-muted text-muted-foreground",
        MONOGRAM_SIZE[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/**
 * Compact human identity: monogram + name (optionally a canonical profile link)
 * + quiet Employee Number, with optional secondary work context on its own line.
 * The single shared identity treatment for roster, manager picker, review, and
 * direct reports.
 */
export function EmployeeIdentity({
  name,
  employeeNumber,
  href,
  secondary,
  size = "md",
  accent = false,
  linkClassName,
  className,
}: {
  name: string;
  employeeNumber?: string | null;
  href?: string;
  secondary?: ReactNode;
  size?: MonogramSize;
  accent?: boolean;
  linkClassName?: string;
  className?: string;
}) {
  const nameNode = href ? (
    <Link
      href={href}
      className={cn(
        "type-label font-semibold underline-offset-4 outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring",
        linkClassName,
      )}
    >
      {name}
    </Link>
  ) : (
    <span className="type-label font-semibold">{name}</span>
  );

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <Monogram name={name} size={size} accent={accent} />
      <div className="min-w-0">
        <div className="truncate leading-tight">{nameNode}</div>
        {employeeNumber ? (
          <div className="mt-0.5 type-code text-xs text-muted-foreground">{employeeNumber}</div>
        ) : null}
        {secondary ? (
          <div className="mt-0.5 type-meta truncate text-muted-foreground">{secondary}</div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Organization path grammar: the assigned unit reads first; ancestry is quiet
 * context beneath it. Avoids a long slash path being the only presentation
 * while preserving enough to disambiguate duplicate unit names.
 */
export function OrgPath({
  name,
  path,
  className,
  unitClassName,
  ancestryClassName,
  showAncestry = true,
}: {
  name?: string | null;
  path: string;
  className?: string;
  unitClassName?: string;
  ancestryClassName?: string;
  /** Show the parent-path line beneath the unit. Off for dense rosters — the full path
   * still travels as a hover title for disambiguation. */
  showAncestry?: boolean;
}) {
  const segments = path.split("/").map((segment) => segment.trim()).filter(Boolean);
  const unit = (name && name.trim()) || segments.at(-1) || path;
  const ancestry = segments.slice(0, -1).join(" / ");
  return (
    <span className={cn("block min-w-0", className)}>
      <span className={cn("block truncate type-body", unitClassName)} title={ancestry ? path : undefined}>
        {unit}
      </span>
      {showAncestry && ancestry ? (
        <span className={cn("block truncate type-meta text-muted-foreground", ancestryClassName)}>
          {ancestry}
        </span>
      ) : null}
    </span>
  );
}

export function employmentTone(state: PeopleEmploymentState): StatusTone {
  return STATE_TONE[state];
}

/** Workforce status as a restrained, non-color-only badge with a leading dot. */
export function EmploymentStatus({
  state,
  className,
}: {
  state: PeopleEmploymentState;
  className?: string;
}) {
  return (
    <StatusBadge tone={STATE_TONE[state]} dot className={className}>
      {state}
    </StatusBadge>
  );
}

/**
 * Unambiguous date-only rendering. Uses `<day> <month> <year>` so a stored
 * 2021-02-01 always reads as "1 Feb 2021" for every locale — never the
 * ambiguous US `01/02/2021` (§16). Date semantics stay in UTC and are never
 * silently reinterpreted by the active language.
 */
export function formatWorkforceDate(
  value: string | null | undefined,
  options?: { month?: "short" | "long" },
): string {
  if (!value) return "";
  const iso = value.length <= 10 ? `${value}T00:00:00Z` : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: options?.month ?? "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
