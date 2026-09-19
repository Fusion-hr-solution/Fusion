"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import type {
  OrgUnitSelectionInput,
  PopulationCandidateDto,
  PopulationMode,
  SetPopulationRequest,
} from "@repo/api";
import { AsyncButton } from "@repo/ds/shell";
import { PageSkeleton } from "@repo/ds/shell";
import {
  usePopulation,
  usePopulationMutations,
} from "@/features/performance/api/use-performance";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { SetupStepFooter } from "./setup-step-footer";
import { PopulationHero } from "./population/population-hero";
import { PopulationScope } from "./population/population-scope";
import { ResolvedPopulation } from "./population/resolved-population";
import { NeedsAttention } from "./population/needs-attention";
import { PeopleInScope } from "./population/people-in-scope";
import { ExcludeDialog } from "./population/exclude-dialog";
import { AddInclusionSheet } from "./population/add-inclusion-sheet";
import { PersonDetailDrawer } from "./population/person-detail-drawer";
import {
  candidateStatus,
  selectionToRequest,
} from "./population/population-model";

/**
 * Step 2 — Population. One workspace over the existing population domain: choose the scope, let
 * Fusion resolve the workforce and reviewers, resolve or exclude the blockers, then confirm. All
 * eligibility/roster truth stays on the backend; this orchestrates the selection edits (each a
 * wholesale PUT with cache write-through) and the confirm/reconfirm transition.
 */
export function PopulationStep({ cycleId }: { cycleId: string }) {
  const router = useRouter();
  const population = usePopulation(cycleId);
  const { set, confirm } = usePopulationMutations(cycleId);

  const [hasConfirmedOnce, setHasConfirmedOnce] = useState(false);
  const [excludeTarget, setExcludeTarget] =
    useState<PopulationCandidateDto | null>(null);
  const [inclusionSheetOpen, setInclusionSheetOpen] = useState(false);
  const [inspectTarget, setInspectTarget] =
    useState<PopulationCandidateDto | null>(null);
  const [inspectOpen, setInspectOpen] = useState(false);

  const data = population.data;
  const selection = data?.selection;

  useEffect(() => {
    if (selection?.isConfirmed) setHasConfirmedOnce(true);
  }, [selection?.isConfirmed]);

  const applyOptimistic = useCallback(
    (patch: Partial<SetPopulationRequest>, errorMessage: string) => {
      if (!selection) return;
      set
        .mutateAsync({ ...selectionToRequest(selection), ...patch })
        .catch((error) =>
          toast.error(error instanceof Error ? error.message : errorMessage)
        );
    },
    [selection, set]
  );

  const onSetMode = useCallback(
    (mode: PopulationMode) => {
      if (!selection || selection.mode === mode) return;
      applyOptimistic({ mode }, "Could not change the scope.");
    },
    [selection, applyOptimistic]
  );

  const onApplyOrgSelections = useCallback(
    (orgUnitSelections: OrgUnitSelectionInput[]) =>
      applyOptimistic(
        { mode: "ByScope", orgUnitSelections },
        "Could not update the organization scope."
      ),
    [applyOptimistic]
  );

  const onAddInclusions = useCallback(
    async (employeeIds: string[]) => {
      if (!selection) return;
      const existing = new Set(selection.inclusions);
      const additions = employeeIds.filter((id) => !existing.has(id));
      if (additions.length === 0) return;
      await set.mutateAsync({
        ...selectionToRequest(selection),
        inclusions: [...selection.inclusions, ...additions],
      });
    },
    [selection, set]
  );

  const onRemoveInclusion = useCallback(
    (employeeId: string) => {
      if (!selection) return;
      applyOptimistic(
        { inclusions: selection.inclusions.filter((id) => id !== employeeId) },
        "Could not remove the employee."
      );
    },
    [selection, applyOptimistic]
  );

  const onRestore = useCallback(
    (candidate: PopulationCandidateDto) => {
      if (!selection) return;
      applyOptimistic(
        {
          exclusions: selection.exclusions.filter(
            (exclusion) => exclusion.employeeId !== candidate.employeeId
          ),
        },
        "Could not restore the employee."
      );
    },
    [selection, applyOptimistic]
  );

  const onExcludeMany = useCallback(
    async (many: PopulationCandidateDto[], reason: string) => {
      if (!selection) return;
      const existing = new Set(
        selection.exclusions.map((exclusion) => exclusion.employeeId)
      );
      const additions = many
        .filter((candidate) => !existing.has(candidate.employeeId))
        .map((candidate) => ({ employeeId: candidate.employeeId, reason }));
      if (additions.length === 0) return;
      await set.mutateAsync({
        ...selectionToRequest(selection),
        exclusions: [...selection.exclusions, ...additions],
      });
    },
    [selection, set]
  );

  const onExcludeConfirmed = useCallback(
    async (reason: string) => {
      if (!selection || !excludeTarget) return;
      await set.mutateAsync({
        ...selectionToRequest(selection),
        exclusions: [
          ...selection.exclusions,
          { employeeId: excludeTarget.employeeId, reason },
        ],
      });
    },
    [selection, excludeTarget, set]
  );

  const inspect = useCallback((candidate: PopulationCandidateDto) => {
    setInspectTarget(candidate);
    setInspectOpen(true);
  }, []);

  const attention = useMemo(
    () =>
      (data?.candidates ?? []).filter(
        (candidate) => candidateStatus(candidate) === "attention"
      ),
    [data?.candidates]
  );

  // People the org-unit rule matched (everyone resolved except those added as individual
  // exceptions) — the real, resolved figure the scope picker reads back, not an estimate.
  const matchedCount = useMemo(
    () =>
      data && selection?.mode === "ByScope"
        ? data.candidates.filter((candidate) => !candidate.byExplicitInclusion)
            .length
        : null,
    [data, selection?.mode]
  );

  // The employees the current scope already covers (matched, not individually added), with the unit
  // they came in through — lets the picker say "already included through {unit}".
  const scopeMemberUnits = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const candidate of data?.candidates ?? []) {
      if (!candidate.byExplicitInclusion)
        map.set(candidate.employeeId, candidate.orgUnitName);
    }
    return map;
  }, [data?.candidates]);

  // The individually-added exceptions, resolved back with identity for the main section's list.
  const inclusionCandidates = useMemo(() => {
    const ids = new Set(selection?.inclusions ?? []);
    return (data?.candidates ?? []).filter((candidate) =>
      ids.has(candidate.employeeId)
    );
  }, [data?.candidates, selection?.inclusions]);

  if (population.error && (!data || !selection)) {
    return (
      <ContentUnavailable
        error={population.error}
        onRetry={population.refetch}
        subject="The population"
      />
    );
  }
  if (population.isLoading || !data || !selection) {
    return <PageSkeleton rows={4} label="Resolving population" />;
  }

  const isConfirmed = selection.isConfirmed;
  const inclusionIds = new Set(selection.inclusions);
  const hasNoScope =
    selection.mode === "ByScope" && selection.orgUnitSelections.length === 0;
  const canConfirm =
    !hasNoScope && data.needsAttentionCount === 0 && data.readyCount > 0;
  const footerMessageId = "population-footer-status";

  return (
    <div className="space-y-6">
      <PopulationHero />

      <div>
        <h1 className="type-page-title text-foreground">Population</h1>
        <p className="mt-1 type-body-secondary text-muted-foreground">
          Select who will participate. Fusion validates eligibility and reviewer
          coverage.
        </p>
      </div>

      <PopulationScope
        mode={selection.mode}
        eligibilityDate={selection.eligibilityDate}
        orgSelections={selection.orgUnitSelections}
        matchedCount={matchedCount}
        inclusions={inclusionCandidates}
        tenantName={null}
        onSetMode={onSetMode}
        onApplyOrgSelections={onApplyOrgSelections}
        onRemoveInclusion={onRemoveInclusion}
        onInspectInclusion={inspect}
        onOpenInclusionSheet={() => setInclusionSheetOpen(true)}
      />

      {hasNoScope ? null : (
        <>
          <ResolvedPopulation
            population={data}
            onRefresh={() => void population.refetch()}
            refreshing={population.isFetching || set.isLoading}
          />
          <NeedsAttention
            candidates={attention}
            eligibilityDate={selection.eligibilityDate}
            onExclude={setExcludeTarget}
          />
          <PeopleInScope
            candidates={data.candidates}
            onExclude={setExcludeTarget}
            onRestore={onRestore}
            onExcludeMany={onExcludeMany}
            onRemoveInclusion={(candidate) =>
              onRemoveInclusion(candidate.employeeId)
            }
            onInspect={inspect}
          />
        </>
      )}

      <SetupStepFooter
        backHref="/cycle/setup/details"
        center={
          isConfirmed ? (
            <div
              id={footerMessageId}
              className="flex flex-col items-center gap-0.5"
            >
              <span className="inline-flex items-center gap-2 type-label text-emerald-600 dark:text-emerald-400">
                <CircleCheck className="size-4" aria-hidden />
                Population confirmed
              </span>
              <span className="type-meta text-muted-foreground">
                {data.readyCount} participants · {data.reviewerReadyCount}{" "}
                reviewers resolved
              </span>
            </div>
          ) : hasNoScope ? (
            <span
              id={footerMessageId}
              className="type-body-secondary text-muted-foreground"
            >
              Select an organization unit to continue.
            </span>
          ) : !canConfirm && data.needsAttentionCount > 0 ? (
            <span
              id={footerMessageId}
              className="inline-flex items-center gap-2 type-label text-amber-600 dark:text-amber-400"
            >
              <TriangleAlert className="size-4" aria-hidden />
              {data.needsAttentionCount}{" "}
              {data.needsAttentionCount === 1 ? "issue" : "issues"} must be
              resolved before confirmation.
            </span>
          ) : data.readyCount === 0 ? (
            <span
              id={footerMessageId}
              className="type-body-secondary text-muted-foreground"
            >
              At least one eligible participant is required.
            </span>
          ) : hasConfirmedOnce ? (
            <div
              id={footerMessageId}
              className="flex flex-col items-center gap-0.5"
            >
              <span className="inline-flex items-center gap-2 type-label text-amber-600 dark:text-amber-400">
                Population changed. Confirm it again to continue.
              </span>
              <span className="type-meta text-muted-foreground">
                {data.readyCount} participants · {data.reviewerReadyCount}{" "}
                reviewers resolved
              </span>
            </div>
          ) : (
            <span
              id={footerMessageId}
              className="type-body-secondary text-muted-foreground"
            >
              {data.readyCount} participants · {data.reviewerReadyCount}{" "}
              reviewers resolved
            </span>
          )
        }
      >
        {isConfirmed ? (
          <AsyncButton
            pending={false}
            onClick={() => router.push("/cycle/setup/review")}
          >
            Continue
            <ArrowRight className="size-4" data-icon="inline-end" />
          </AsyncButton>
        ) : (
          <AsyncButton
            pending={confirm.isLoading}
            disabled={!canConfirm}
            aria-describedby={footerMessageId}
            onClick={async () => {
              try {
                await confirm.mutateAsync();
                setHasConfirmedOnce(true);
                toast.success("Population confirmed.");
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not confirm the population."
                );
              }
            }}
          >
            {hasConfirmedOnce ? "Re-confirm population" : "Confirm population"}
          </AsyncButton>
        )}
      </SetupStepFooter>

      <ExcludeDialog
        name={excludeTarget?.displayName ?? null}
        open={excludeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setExcludeTarget(null);
        }}
        onExclude={onExcludeConfirmed}
      />

      <AddInclusionSheet
        open={inclusionSheetOpen}
        onOpenChange={setInclusionSheetOpen}
        inclusionIds={inclusionIds}
        scopeMembers={scopeMemberUnits}
        onAddMany={onAddInclusions}
      />

      <PersonDetailDrawer
        candidate={inspectTarget}
        open={inspectOpen}
        onOpenChange={setInspectOpen}
        eligibilityDate={selection.eligibilityDate}
        onExclude={(candidate) => {
          setInspectOpen(false);
          setExcludeTarget(candidate);
        }}
        onRestore={(candidate) => {
          setInspectOpen(false);
          onRestore(candidate);
        }}
      />
    </div>
  );
}
