"use client";

import {
  CalendarCheck,
  Network,
  Plus,
  Users2,
  UsersRound,
  X,
} from "@/lib/icons";
import type {
  OrgUnitSelectionInput,
  PopulationCandidateDto,
  PopulationMode,
} from "@repo/api";
import { Avatar, AvatarFallback } from "@repo/ds/components/ui/avatar";
import { Button } from "@repo/ds/components/ui/button";
import { cn } from "@repo/ds/lib/utils";

import { OrgScopePicker } from "./org-scope-picker";
import { initials } from "./population-model";
import { useTranslations } from "next-intl";
import { useFormat } from "@repo/ds/lib/use-format";

/**
 * Layer 1 — how the population is chosen. Two strong tiles carry the mode; choosing "Selected
 * organization units" reveals the inline tree-and-scope picker directly beneath them, and the
 * individual exceptions row stays available at the foot. Eligibility date is shown, never chosen
 * here — it follows the cycle's start date.
 */
export function PopulationScope({
  cycleId,
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
  cycleId: string;
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
  const format = useFormat();
  const t = useTranslations("cycleSetup.PopulationScope");
  const byScope = mode === "ByScope";

  return (
    <section className="rounded-surface border border-border bg-card p-5 lg:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary-tint text-primary-ink type-meta font-semibold tabular-nums">
            1
          </span>
          <div>
            <h2 className="type-section-title text-foreground">
              {t("populationScope")}
            </h2>
            <p className="type-meta text-muted-foreground">
              {t("chooseHowToSelectParticipants")}
            </p>
          </div>
        </div>
        <span className="flex items-center gap-2 rounded-control border border-border bg-inlay px-3 py-1.5">
          <CalendarCheck
            className="size-3.5 text-muted-foreground"
            aria-hidden
          />
          <span className="type-meta text-muted-foreground">
            {t("eligibilityDate")}
          </span>
          <span className="type-label tabular-nums text-foreground">
            {format.date(eligibilityDate)}
          </span>
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <ScopeTile
          selected={!byScope}
          onClick={() => onSetMode("AllActive")}
          icon={<UsersRound className="size-5" strokeWidth={1.75} />}
          title={t("allActiveEmployees")}
          description={t("everyoneEligibleAcross", { value: tenantName ?? "the organization" })}
          recommended
        />
        <ScopeTile
          selected={byScope}
          onClick={() => onSetMode("ByScope")}
          icon={<Network className="size-5" strokeWidth={1.75} />}
          title={t("selectedOrganizationUnits")}
          description={t("chooseSpecificUnitsAndOptionally")}
        />
      </div>

      {byScope ? (
        <OrgScopePicker
          cycleId={cycleId}
          asOf={eligibilityDate}
          selections={orgSelections}
          matchedCount={matchedCount}
          onChange={onApplyOrgSelections}
        />
      ) : null}

      {byScope || inclusions.length > 0 ? (
        <div className="mt-4 rounded-surface border border-border bg-inlay p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-muted text-muted-foreground">
                <Users2 className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="type-label text-foreground">
                  {byScope ? t("populationExceptions") : t("savedScopeAdditions")}
                </p>
                <p className="type-meta text-muted-foreground">
                  {!byScope
                    ? t("theseAdditionsAreRetainedIf")
                    : inclusions.length > 0
                      ? (inclusions.length === 1 ? t("specificEmployeeAdded", { length: inclusions.length }) : t("specificEmployeesAdded", { length: inclusions.length }))
                      : t("addSpecificEmployeesOutsideThe")}
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
                {t("addSpecificEmployees")}
              </Button>
            ) : null}
          </div>

          {inclusions.length > 0 ? (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {inclusions.map((candidate) => (
                <li
                  key={candidate.employeeId}
                  className="flex items-center gap-2.5 rounded-surface border border-border bg-card px-3 py-2"
                >
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback className="text-[10px]">
                      {initials(candidate.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => onInspectInclusion(candidate)}
                    className="min-w-0 flex-1 text-start"
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
                    className="flex size-7 shrink-0 items-center justify-center rounded-control-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={t("remove", { displayName: candidate.displayName })}
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
  const t = useTranslations("cycleSetup.ScopeTile");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group flex min-w-0 items-center gap-3 rounded-surface border px-4 py-4 text-start transition-colors sm:gap-4 sm:px-5",
        selected
          ? "border-primary/80 bg-primary/[0.07] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_35%,transparent)]"
          : "border-border bg-inlay hover:border-muted-foreground/30 hover:bg-muted"
      )}
    >
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected ? "border-primary" : "border-muted-foreground/40 group-hover:border-muted-foreground/60"
        )}
        aria-hidden
      >
        {selected ? (
          <span className="size-3 rounded-full bg-primary" />
        ) : null}
      </span>
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-control transition-colors sm:size-12",
          selected
            ? "bg-primary-tint text-primary-ink"
            : "bg-muted text-foreground/80"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="type-body font-semibold text-foreground">{title}</span>
          {recommended ? (
            <span className="rounded-control bg-primary-tint px-2 py-0.5 type-meta font-medium text-primary-ink">
              {t("recommended")}
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
