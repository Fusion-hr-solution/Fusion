"use client";

import {
  CalendarCheck,
  Network,
  Plus,
  Users2,
  UsersRound,
  X,
} from "lucide-react";
import type {
  OrgUnitSelectionInput,
  PopulationCandidateDto,
  PopulationMode,
} from "@repo/api";
import { Avatar, AvatarFallback } from "@repo/ds/components/ui/avatar";
import { Button } from "@repo/ds/components/ui/button";
import { cn } from "@repo/ds/lib/utils";
import { formatDate } from "@/features/performance/lib";
import { OrgScopePicker } from "./org-scope-picker";
import { initials } from "./population-model";

/**
 * Layer 1 — how the population is chosen. Two strong tiles carry the mode; choosing "Selected
 * organization units" reveals the inline tree-and-scope picker directly beneath them, and the
 * individual exceptions row stays available at the foot. Eligibility date is shown, never chosen
 * here — it follows the cycle's start date.
 */
export function PopulationScope({
  mode,
  eligibilityDate,
  orgSelections,
  matchedCount,
  inclusions,
  tenantName,
  onSetMode,
  onApplyOrgSelections,
  onRemoveInclusion,
  onInspectInclusion,
  onOpenInclusionSheet,
}: {
  mode: PopulationMode;
  eligibilityDate: string;
  orgSelections: OrgUnitSelectionInput[];
  matchedCount: number | null;
  inclusions: PopulationCandidateDto[];
  tenantName: string | null;
  onSetMode: (mode: PopulationMode) => void;
  onApplyOrgSelections: (selections: OrgUnitSelectionInput[]) => void;
  onRemoveInclusion: (employeeId: string) => void;
  onInspectInclusion: (candidate: PopulationCandidateDto) => void;
  onOpenInclusionSheet: () => void;
}) {
  const byScope = mode === "ByScope";

  return (
    <section className="rounded-2xl border border-border bg-card p-5 lg:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-primary type-meta font-semibold tabular-nums">
            1
          </span>
          <div>
            <h2 className="type-section-title text-foreground">
              Population scope
            </h2>
            <p className="type-meta text-muted-foreground">
              Choose how to select participants.
            </p>
          </div>
        </div>
        <span className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5">
          <CalendarCheck
            className="size-3.5 text-muted-foreground"
            aria-hidden
          />
          <span className="type-meta text-muted-foreground">
            Eligibility date
          </span>
          <span className="type-label tabular-nums text-foreground">
            {formatDate(eligibilityDate)}
          </span>
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <ScopeTile
          selected={!byScope}
          onClick={() => onSetMode("AllActive")}
          icon={<UsersRound className="size-5" />}
          title="All active employees"
          description={`Everyone eligible across ${tenantName ?? "the organization"}.`}
          recommended
        />
        <ScopeTile
          selected={byScope}
          onClick={() => onSetMode("ByScope")}
          icon={<Network className="size-5" />}
          title="Selected organization units"
          description="Choose specific units and optionally their sub-units."
        />
      </div>

      {byScope ? (
        <OrgScopePicker
          asOf={eligibilityDate}
          selections={orgSelections}
          matchedCount={matchedCount}
          onChange={onApplyOrgSelections}
        />
      ) : null}

      {byScope || inclusions.length > 0 ? (
        <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground">
                <Users2 className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="type-label text-foreground">
                  {byScope ? "Population exceptions" : "Saved scope additions"}
                </p>
                <p className="type-meta text-muted-foreground">
                  {!byScope
                    ? "These additions are retained if you return to selected organization units."
                    : inclusions.length > 0
                      ? `${inclusions.length} specific ${inclusions.length === 1 ? "employee" : "employees"} added`
                      : "Add specific employees outside the selected organization scope."}
                </p>
              </div>
            </div>
            {byScope ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenInclusionSheet}
              >
                <Plus className="size-4" data-icon="inline-start" />
                Add specific employees
              </Button>
            ) : null}
          </div>

          {inclusions.length > 0 ? (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {inclusions.map((candidate) => (
                <li
                  key={candidate.employeeId}
                  className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2"
                >
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback className="text-[10px]">
                      {initials(candidate.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => onInspectInclusion(candidate)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="type-label truncate text-foreground">
                      {candidate.displayName}
                    </p>
                    <p className="type-meta truncate text-muted-foreground">
                      {[candidate.jobTitle ?? "—", candidate.orgUnitName]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveInclusion(candidate.employeeId)}
                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={`Remove ${candidate.displayName}`}
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ScopeTile({
  selected,
  onClick,
  icon,
  title,
  description,
  recommended,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  recommended?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
        selected
          ? "border-primary bg-primary/[0.06] ring-1 ring-primary/40"
          : "border-border bg-card hover:border-border/80 hover:bg-muted/30"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected ? "border-primary" : "border-muted-foreground/40"
        )}
        aria-hidden
      >
        {selected ? (
          <span className="size-2.5 rounded-full bg-primary" />
        ) : null}
      </span>
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
          selected
            ? "bg-primary/15 text-primary"
            : "bg-muted text-muted-foreground"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="type-label text-foreground">{title}</span>
          {recommended ? (
            <span className="rounded-md bg-primary/15 px-1.5 py-0.5 type-meta font-medium text-primary">
              Recommended
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block type-body-secondary text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  );
}
