"use client";

import Link from "next/link";
import { useCallback, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PersonAvatar, cn, personInitials, type PersonAvatarSize } from "@repo/ds";
import { usePhoto } from "@repo/api/query";
import { StatusBadge, type StatusTone } from "@repo/ds/shell";
import type { PeopleEmploymentState } from "@repo/api";
import { dateFormatter } from "@repo/ds/lib/dates";

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

type MonogramSize = Extract<PersonAvatarSize, "xs" | "sm" | "md" | "lg" | "xl">;

/** Two-letter monogram derived from the display name — deterministic, never random. */
export const initials = personInitials;

/**
 * A person's mark: their photo when they have one, their initials otherwise. The same circle for everyone
 * (no per-person colour), loaded through the API client from the versioned `photoUrl`.
 */
export function Monogram({
  name,
  photoUrl,
  size = "md",
  accent = false,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  size?: MonogramSize;
  accent?: boolean;
  className?: string;
}) {
  const marked = cn(accent && "bg-primary/12 text-foreground ring-1 ring-inset ring-primary/25", className);
  // Only a person with a photo touches the photo cache.
  return photoUrl ? (
    <PhotoMonogram name={name} photoUrl={photoUrl} size={size} className={marked} />
  ) : (
    <PersonAvatar name={name} size={size} className={marked} />
  );
}

function PhotoMonogram({ name, photoUrl, size, className }: { name: string; photoUrl: string; size: MonogramSize; className?: string }) {
  const photo = usePhoto(photoUrl);
  return <PersonAvatar name={name} photo={photo} size={size} className={className} />;
}

/**
 * Compact human identity: monogram + name (optionally a canonical profile link)
 * + quiet Employee Number, with optional secondary work context on its own line.
 * The single shared identity treatment for roster, manager picker, review, and
 * direct reports.
 */
export function EmployeeIdentity({
  name,
  photoUrl,
  employeeNumber,
  href,
  secondary,
  size = "md",
  accent = false,
  linkClassName,
  className,
}: {
  name: string;
  photoUrl?: string | null;
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
        "type-label font-semibold underline-offset-4 outline-none hover:underline focus-visible:rounded-control focus-visible:ring-2 focus-visible:ring-ring",
        linkClassName
      )}
    >
      {name}
    </Link>
  ) : (
    <span className="type-label font-semibold">{name}</span>
  );

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <Monogram name={name} photoUrl={photoUrl} size={size} accent={accent} />
      <div className="min-w-0">
        <div className="truncate leading-tight">{nameNode}</div>
        {employeeNumber ? (
          <div className="mt-0.5 type-code text-xs text-muted-foreground">
            {employeeNumber}
          </div>
        ) : null}
        {secondary ? (
          <div className="mt-0.5 type-meta truncate text-muted-foreground">
            {secondary}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Human-first identity used when access, relationship, or profile decisions need
 * more context than a roster name. Work context stays readable as one sentence so
 * the person remains the visual anchor instead of a stack of metadata fields.
 */
export function PersonIdentity({
  name,
  email,
  jobTitle,
  organization,
  employeeNumber,
  href,
  size = "md",
  accent = false,
  missingEmailLabel,
  className,
}: {
  name: string;
  email?: string | null;
  jobTitle?: string | null;
  organization?: string | null;
  employeeNumber?: string | null;
  href?: string;
  size?: MonogramSize;
  accent?: boolean;
  missingEmailLabel?: string;
  className?: string;
}) {
  const t = useTranslations("people.identity");
  const workContext = [jobTitle, organization].filter(Boolean).join(" · ");

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <Monogram name={name} size={size} accent={accent} />
      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-2">
          {href ? (
            <Link
              href={href}
              className="type-label truncate font-semibold underline-offset-4 outline-none hover:underline focus-visible:rounded-control focus-visible:ring-2 focus-visible:ring-ring"
            >
              {name}
            </Link>
          ) : (
            <span className="type-label truncate font-semibold text-foreground">
              {name}
            </span>
          )}
          {employeeNumber ? (
            <span className="hidden shrink-0 type-code text-xs text-muted-foreground xl:inline">
              {employeeNumber}
            </span>
          ) : null}
        </div>
        {workContext ? (
          <p className="mt-0.5 truncate type-meta text-muted-foreground">
            {workContext}
          </p>
        ) : null}
        <p
          className={cn(
            "mt-0.5 truncate type-meta",
            email
              ? "text-muted-foreground"
              : "font-medium text-warning-foreground"
          )}
        >
          {email || (missingEmailLabel ?? t("missingEmail"))}
        </p>
      </div>
    </div>
  );
}

/** A named human relationship, never a bare manager id or property row. */
export function PersonRelationship({
  label,
  name,
  detail,
  href,
  emptyLabel,
  className,
}: {
  label: string;
  name?: string | null;
  detail?: ReactNode;
  href?: string;
  emptyLabel?: string;
  className?: string;
}) {
  const t = useTranslations("people.identity");
  return (
    <div className={className}>
      <p className="type-eyebrow text-muted-foreground">{label}</p>
      {name ? (
        <div className="mt-2">
          <EmployeeIdentity name={name} href={href} secondary={detail} accent />
        </div>
      ) : (
        <p className="mt-1 type-body text-muted-foreground">{emptyLabel ?? t("notAssigned")}</p>
      )}
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
  const segments = path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  const unit = (name && name.trim()) || segments.at(-1) || path;
  const ancestry = segments.slice(0, -1).join(" / ");
  return (
    <span className={cn("block min-w-0", className)}>
      <span
        className={cn("block truncate type-body", unitClassName)}
        title={ancestry ? path : undefined}
      >
        {unit}
      </span>
      {showAncestry && ancestry ? (
        <span
          className={cn(
            "block truncate type-meta text-muted-foreground",
            ancestryClassName
          )}
        >
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
  const t = useTranslations("people.states");
  return (
    <StatusBadge tone={STATE_TONE[state]} dot className={className}>
      {t(state)}
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
  options?: { month?: "short" | "long"; locale?: string }
): string {
  if (!value) return "";
  const iso = value.length <= 10 ? `${value}T00:00:00Z` : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return dateFormatter({
    day: "numeric",
    month: options?.month ?? "short",
    year: "numeric",
    timeZone: "UTC",
  }, options?.locale).format(date);
}

/** {@link formatWorkforceDate} in the person's language. */
export function useWorkforceDate(): (value: string | null | undefined, options?: { month?: "short" | "long" }) => string {
  const locale = useLocale();
  return useCallback((value, options) => formatWorkforceDate(value, { ...options, locale }), [locale]);
}
