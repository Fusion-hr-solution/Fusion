"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarRange, CircleCheck, Pencil, SlidersHorizontal, Users } from "lucide-react";
import type { CycleDetailDto, CycleSettingsDto, PopulationDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { cn } from "@repo/ds/lib/utils";
import { formatDate, MEASUREMENT_LABELS } from "../../../lib";

/**
 * The three settled facts of the Cycle, laid out as calm read-only records the admin confirms
 * before committing. Each card names what it captures, marks itself settled, and offers one route
 * back to its own setup step — no re-editing in place, no restating what the values already say.
 */

function CompleteBadge({ children = "Complete" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
      <CircleCheck className="size-3" aria-hidden />
      {children}
    </span>
  );
}

function SummaryCard({
  icon: Icon,
  title,
  badge,
  editHref,
  editLabel,
  children,
}: {
  icon: typeof Users;
  title: string;
  badge: ReactNode;
  editHref?: string;
  editLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex items-center gap-3 border-b border-border/70 px-5 py-4 sm:px-6">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/12 text-success">
          <Icon className="size-4.5" aria-hidden />
        </span>
        <h2 className="type-panel-title text-foreground">{title}</h2>
        {badge}
        {editHref ? (
          <Button variant="ghost" size="sm" asChild className="ml-auto -my-1">
            <Link href={editHref} aria-label={editLabel ?? `Edit ${title.toLowerCase()}`}>
              <Pencil className="size-3.5" data-icon="inline-start" />
              Edit
            </Link>
          </Button>
        ) : null}
      </header>
      <dl className="px-5 sm:px-6">{children}</dl>
    </section>
  );
}

function Row({
  label,
  children,
  align = "top",
}: {
  label: string;
  children: ReactNode;
  align?: "top" | "center";
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-x-6 gap-y-1 border-b border-border/50 py-3.5 last:border-0 sm:grid-cols-[minmax(0,10.5rem)_minmax(0,1fr)]",
        align === "center" ? "sm:items-center" : "sm:items-baseline"
      )}
    >
      <dt className="type-body-secondary text-muted-foreground">{label}</dt>
      <dd className="type-body-secondary text-foreground">{children}</dd>
    </div>
  );
}

export function CycleDetailsCard({ detail }: { detail: CycleDetailDto }) {
  const c = detail.cycle;
  return (
    <SummaryCard
      icon={CalendarRange}
      title="Cycle details"
      badge={<CompleteBadge />}
      editHref="/cycle/setup/details"
    >
      <Row label="Name">
        <span className="font-medium text-foreground">{c.name}</span>
      </Row>
      <Row label="Description">
        {c.description ? c.description : <span className="text-muted-foreground">Not set</span>}
      </Row>
      <Row label="Performance period">
        <span className="tabular-nums">
          {formatDate(c.startDate)} – {formatDate(c.endDate)}
        </span>
      </Row>
      <Row label="Planning deadline">
        <span className="tabular-nums">{formatDate(c.planningDeadline)}</span>
      </Row>
    </SummaryCard>
  );
}

export function PopulationCard({
  detail,
  population,
  unitNames,
  includeDescendants,
}: {
  detail: CycleDetailDto;
  population: PopulationDto;
  unitNames: string[] | null;
  includeDescendants: boolean;
}) {
  const sel = population.selection;
  const byScope = sel.mode === "ByScope";
  const required = population.reviewerRequiredCount;
  const ready = population.reviewerReadyCount;
  const fullCoverage = required === 0 || ready >= required;

  return (
    <SummaryCard
      icon={Users}
      title="Population"
      badge={<CompleteBadge>Confirmed</CompleteBadge>}
      editHref="/cycle/setup/population"
    >
      <Row label="Scope">
        {byScope ? "Selected organization units" : "All active employees"}
      </Row>
      <Row label="Eligibility date">
        <span className="tabular-nums">{formatDate(sel.eligibilityDate)}</span>
      </Row>
      {byScope ? (
        <Row label="Organization units">
          {unitNames && unitNames.length > 0 ? (
            <span>
              {unitNames.join(", ")}
              {includeDescendants ? (
                <span className="mt-0.5 block type-meta text-muted-foreground">
                  Including all sub-units
                </span>
              ) : null}
            </span>
          ) : (
            <span className="tabular-nums">
              {sel.orgUnitSelections.length}{" "}
              {sel.orgUnitSelections.length === 1 ? "unit" : "units"}
            </span>
          )}
        </Row>
      ) : null}
      {sel.inclusions.length > 0 ? (
        <Row label="Added individually">
          <span className="tabular-nums">
            {sel.inclusions.length} {sel.inclusions.length === 1 ? "person" : "people"}
          </span>
        </Row>
      ) : null}
      {sel.exclusions.length > 0 ? (
        <Row label="Excluded">
          <span className="tabular-nums">
            {sel.exclusions.length} {sel.exclusions.length === 1 ? "person" : "people"}
          </span>
        </Row>
      ) : null}
      <Row label="Confirmed participants" align="center">
        <span className="text-base font-semibold tabular-nums text-foreground">
          {detail.confirmedParticipantCount}
        </span>
      </Row>
      <Row label="Reviewer coverage" align="center">
        {fullCoverage ? (
          <span className="inline-flex items-center gap-1.5">
            <CircleCheck className="size-4 text-success" aria-hidden />
            <span>Every participant has a reviewer</span>
          </span>
        ) : (
          <span className="tabular-nums text-warning">
            {ready} of {required} assigned
          </span>
        )}
      </Row>
    </SummaryCard>
  );
}

export function PolicyCard({ settings }: { settings: CycleSettingsDto }) {
  const { suggestedObjectiveCountMin: min, suggestedObjectiveCountMax: max } = settings;
  const count = min === max ? `${min}` : `${min}–${max}`;
  return (
    <SummaryCard
      icon={SlidersHorizontal}
      title="Performance policy"
      badge={
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
          Frozen at launch
        </span>
      }
    >
      <Row label="Measurement method">
        {MEASUREMENT_LABELS[settings.defaultMeasurementMethod]}
      </Row>
      <Row label="Objectives per plan">
        <span className="tabular-nums">{count} suggested</span>
      </Row>
      <Row label="Standalone objectives">
        {settings.allowStandaloneObjectives ? "Allowed" : "Must align to direction"}
      </Row>
      <Row label="Planning window">
        <span className="tabular-nums">{settings.planningDeadlineOffsetDays} days</span> from start
      </Row>
    </SummaryCard>
  );
}
