"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CircleAlert,
  Rocket,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  ApiError,
  coreWorkforcePaths,
  coreWorkforceQueryKeys,
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
  type CampaignLaunchResultDto,
  type CampaignReadinessParticipantDto,
  type CycleParticipantDto,
  type CyclePopulationPreviewDto,
  type CycleReadinessDto,
  type PagedResponse,
  type OverrideParticipantApproverRequest,
  type PerformanceCycleDetailDto,
  type PopulationRuleInput,
  type SetCyclePopulationRequest,
  type WorkforceOrgUnitTreeDto,
} from "@repo/api";
import { useApiMutation, useApiQuery } from "@repo/api/query";
import { StatusBadge } from "@repo/ds/shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initials } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PeopleCombobox, type PersonOption } from "./people-combobox";
import {
  PopulationScopeTree,
  estimateReach,
  totalWorkforce,
  type ExcludedPerson,
  type PeopleApi,
  type ScopeSelection,
  type UnitMember,
} from "./campaign-population-scope";
import {
  campaignLaunch,
  campaignLaunchPad,
  campaignPopulation,
  campaignReadinessReview,
} from "./campaign-terminology";

type OrgScope = { orgUnitId: string; includeDescendants: boolean };
type Exclusion = {
  employeeId: string;
  name: string | null;
  reason: string;
  orgUnitId: string | null;
};
type MemberSnapshot = UnitMember & { orgUnitId: string };
const READINESS_BLOCKER_LIMIT = 5;
const READINESS_EXCEPTION_LIMIT = 8;

// ── Population scope ─────────────────────────────────────────────────

export function CampaignPopulationSection({
  campaign,
  canManage,
  onSaved,
}: {
  campaign: PerformanceCycleDetailDto;
  canManage: boolean;
  onSaved: () => Promise<unknown> | void;
}) {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const readOnly = !canManage;

  const orgTree = useApiQuery<WorkforceOrgUnitTreeDto>(
    coreWorkforceQueryKeys.orgUnitTree({ maxDepth: 12 }),
    (signal) =>
      apiClient.get<WorkforceOrgUnitTreeDto>(coreWorkforcePaths.orgUnitTree(), {
        signal,
        params: { maxDepth: 12 },
      }),
    { enabled: canManage }
  );
  const roots = useMemo(() => orgTree.data?.roots ?? [], [orgTree.data]);

  const preview = useApiQuery<CyclePopulationPreviewDto>(
    performanceQueryKeys.cyclePopulationPreview(campaign.id),
    (signal) =>
      apiClient.get<CyclePopulationPreviewDto>(
        performancePaths.cyclePopulationPreview(campaign.id),
        {
          signal,
        }
      )
  );

  const [scopes, setScopes] = useState<OrgScope[]>(() =>
    fromRulesScopes(campaign)
  );
  const [exclusions, setExclusions] = useState<Exclusion[]>(() =>
    fromRulesExclusions(campaign)
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingSearchExclusion, setPendingSearchExclusion] =
    useState<PersonOption | null>(null);
  const [pendingSearchReason, setPendingSearchReason] = useState("");

  useEffect(() => {
    setScopes(fromRulesScopes(campaign));
    setExclusions(fromRulesExclusions(campaign));
    setError(null);
    setPendingSearchExclusion(null);
    setPendingSearchReason("");
  }, [campaign]);

  // Enrich excluded display names from the live preview (source of truth stays local state).
  // Also re-runs when `campaign` changes: a refetch resets exclusions to name-less rules, and
  // without this the label would fall back to the raw employee id until the preview refetches.
  useEffect(() => {
    if (!preview.data) return;
    setExclusions((current) =>
      current.map((exclusion) =>
        exclusion.name
          ? exclusion
          : {
              ...exclusion,
              name:
                preview.data!.exclusions.find(
                  (item) => item.employeeId === exclusion.employeeId
                )?.fullName ?? null,
            }
      )
    );
  }, [preview.data, campaign]);

  const save = useApiMutation<
    PerformanceCycleDetailDto,
    SetCyclePopulationRequest
  >(
    (request) =>
      apiClient.put<PerformanceCycleDetailDto>(
        performancePaths.cyclePopulation(campaign.id),
        request,
        {
          headers: { "If-Match": `"${campaign.version}"` },
        }
      ),
    {
      onSuccess: async () => {
        toast.success("Participants updated");
        await onSaved();
        await preview.refetch();
      },
      onError: (err) => setError(messageFor(err)),
    }
  );

  const hasExplicitScope = scopes.length > 0;
  const dirty =
    serialize(scopes, exclusions) !==
    serialize(fromRulesScopes(campaign), fromRulesExclusions(campaign));
  const exclusionMissingReason = exclusions.some(
    (exclusion) => !exclusion.reason.trim()
  );

  // No save button: valid population changes persist themselves shortly after
  // the user stops editing. An exclusion without a reason holds the save.
  useEffect(() => {
    if (!canManage || !dirty || exclusionMissingReason || save.isLoading) {
      return;
    }
    const id = setTimeout(() => {
      setError(null);
      save.mutate(toPopulationRequest(scopes, exclusions));
    }, 600);
    return () => clearTimeout(id);
  }, [canManage, dirty, exclusionMissingReason, save, scopes, exclusions]);

  const scopeById: ScopeSelection = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const scope of scopes)
      map.set(scope.orgUnitId, scope.includeDescendants);
    return map;
  }, [scopes]);
  const workforceTotal = useMemo(() => totalWorkforce(roots), [roots]);
  const reachEstimate = useMemo(
    () => estimateReach(roots, scopeById, exclusions.length),
    [roots, scopeById, exclusions.length]
  );
  // Authoritative count comes from the saved preview; while dirty we show the
  // instant client estimate so the number moves the moment a unit is toggled.
  const resolvedCount =
    !dirty && hasExplicitScope && preview.data ? preview.data.totalCount : null;
  const displayCount = resolvedCount ?? reachEstimate;
  const coveragePct =
    workforceTotal > 0
      ? Math.min(100, Math.round((displayCount / workforceTotal) * 100))
      : 0;
  const pendingLabel = save.isLoading
    ? campaignPopulation.saving
    : campaignPopulation.reachUnsaved;

  const includeUnit = (orgUnitId: string) =>
    setScopes((current) =>
      current.some((scope) => scope.orgUnitId === orgUnitId)
        ? current
        : [...current, { orgUnitId, includeDescendants: true }]
    );
  const removeUnit = (orgUnitId: string) =>
    setScopes((current) =>
      current.filter((scope) => scope.orgUnitId !== orgUnitId)
    );
  const setUnitDescendants = (orgUnitId: string, includeDescendants: boolean) =>
    setScopes((current) =>
      current.map((scope) =>
        scope.orgUnitId === orgUnitId ? { ...scope, includeDescendants } : scope
      )
    );

  // Remember which unit each person belongs to, seen from the resolved preview.
  // Excluded people drop out of `members`, so this keeps placing them under their
  // unit after a save instead of stranding them.
  const memberOrgRef = useRef(new Map<string, string>());
  const memberSnapshotRef = useRef(new Map<string, MemberSnapshot>());
  useEffect(() => {
    for (const [index, member] of (preview.data?.members ?? []).entries()) {
      if (member.orgUnitId) {
        const previous = memberSnapshotRef.current.get(member.employeeId);
        memberOrgRef.current.set(member.employeeId, member.orgUnitId);
        memberSnapshotRef.current.set(member.employeeId, {
          employeeId: member.employeeId,
          fullName: member.fullName,
          jobTitle: member.jobTitle,
          orgUnitId: member.orgUnitId,
          order: previous?.order ?? index,
        });
      }
    }
  }, [preview.data]);

  const membersByUnit = useMemo(() => {
    const map = new Map<string, UnitMember[]>();
    const present = new Set<string>();
    for (const [index, member] of (preview.data?.members ?? []).entries()) {
      if (!member.orgUnitId) continue;
      const snapshot = memberSnapshotRef.current.get(member.employeeId);
      const list = map.get(member.orgUnitId) ?? [];
      list.push({
        employeeId: member.employeeId,
        fullName: member.fullName,
        jobTitle: member.jobTitle,
        order: snapshot?.order ?? index,
      });
      map.set(member.orgUnitId, list);
      present.add(member.employeeId);
    }

    for (const exclusion of exclusions) {
      if (present.has(exclusion.employeeId)) continue;
      const unit =
        exclusion.orgUnitId ??
        memberOrgRef.current.get(exclusion.employeeId) ??
        null;
      if (!unit) continue;
      const snapshot = memberSnapshotRef.current.get(exclusion.employeeId);
      const list = map.get(unit) ?? [];
      list.push({
        employeeId: exclusion.employeeId,
        fullName: exclusion.name ?? snapshot?.fullName ?? exclusion.employeeId,
        jobTitle: snapshot?.jobTitle ?? null,
        order: snapshot?.order ?? Number.MAX_SAFE_INTEGER,
      });
      map.set(unit, list);
    }

    for (const list of map.values()) {
      list.sort(
        (a, b) => a.order - b.order || a.fullName.localeCompare(b.fullName)
      );
    }

    return map;
  }, [preview.data, exclusions]);

  const excludedIds = useMemo(
    () => new Set(exclusions.map((exclusion) => exclusion.employeeId)),
    [exclusions]
  );

  const excludedByUnit = new Map<string, ExcludedPerson[]>();
  const unplacedExclusions: ExcludedPerson[] = [];
  for (const exclusion of exclusions) {
    const person: ExcludedPerson = {
      employeeId: exclusion.employeeId,
      name: exclusion.name ?? exclusion.employeeId,
      reason: exclusion.reason,
    };
    const unit =
      exclusion.orgUnitId ??
      memberOrgRef.current.get(exclusion.employeeId) ??
      null;
    if (unit) {
      const list = excludedByUnit.get(unit) ?? [];
      list.push(person);
      excludedByUnit.set(unit, list);
    } else {
      unplacedExclusions.push(person);
    }
  }

  const addExclusion = (
    employeeId: string,
    name: string,
    orgUnitId: string | null,
    reason: string
  ) =>
    setExclusions((current) =>
      current.some((exclusion) => exclusion.employeeId === employeeId)
        ? current
        : [...current, { employeeId, name, reason, orgUnitId }]
    );
  const excludePerson = (employeeId: string, orgUnitId: string, name: string) =>
    addExclusion(employeeId, name, orgUnitId, "");
  const reincludePerson = (employeeId: string) =>
    setExclusions((current) =>
      current.filter((exclusion) => exclusion.employeeId !== employeeId)
    );
  const setExclusionReason = (employeeId: string, reason: string) =>
    setExclusions((current) =>
      current.map((exclusion) =>
        exclusion.employeeId === employeeId
          ? { ...exclusion, reason }
          : exclusion
      )
    );
  const excludeBySearch = (person: PersonOption) => {
    if (person.orgUnitId) {
      memberOrgRef.current.set(person.employeeId, person.orgUnitId);
    }
    setPendingSearchExclusion(person);
    setPendingSearchReason("");
  };
  const confirmSearchExclusion = () => {
    if (!pendingSearchExclusion || !pendingSearchReason.trim()) return;
    addExclusion(
      pendingSearchExclusion.employeeId,
      pendingSearchExclusion.displayName,
      pendingSearchExclusion.orgUnitId,
      pendingSearchReason.trim()
    );
    setPendingSearchExclusion(null);
    setPendingSearchReason("");
  };

  const people: PeopleApi = {
    membersByUnit,
    excludedByUnit,
    unplacedExclusions,
    excludedIds,
    onExclude: excludePerson,
    onReinclude: reincludePerson,
    onReason: setExclusionReason,
  };

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Reach — the resolved headcount and its share of the whole workforce. */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
          <div className="flex items-baseline gap-2">
            {hasExplicitScope ? (
              <>
                <span className="font-heading text-4xl font-semibold leading-none tracking-tight tabular-nums text-foreground sm:text-5xl">
                  {displayCount.toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground">
                  {campaignPopulation.reachLabel}
                </span>
              </>
            ) : (
              <span className="text-base font-medium text-muted-foreground">
                {campaignPopulation.reachEmpty}
              </span>
            )}
          </div>
          {hasExplicitScope && workforceTotal > 0 ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              {campaignPopulation.ofWorkforce(workforceTotal)}{" "}
              {campaignPopulation.workforceUnit}
              {resolvedCount === null ? ` · ${pendingLabel}` : ""}
            </span>
          ) : null}
        </div>
        {hasExplicitScope && workforceTotal > 0 ? (
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-300"
              style={{ width: `${coveragePct}%` }}
            />
          </div>
        ) : null}
      </section>

      {/* Include from the real org structure — every unit is a node with a live
          headcount; including one paints its whole branch. */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium text-foreground">
                {campaignPopulation.includeHeading}
              </h3>
              {exclusions.length > 0 ? (
                <Badge variant="secondary" className="tabular-nums">
                  {campaignPopulation.excludedCount(exclusions.length)}
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {hasExplicitScope
                ? campaignPopulation.includeHint
                : campaignPopulation.scopeRequiredTitle}
            </p>
          </div>
          {!readOnly ? (
            <div className="flex w-full flex-col gap-2 sm:w-72">
              <PeopleCombobox
                placeholder={campaignPopulation.findPerson}
                disabled={!hasExplicitScope}
                excludeIds={exclusions.map((exclusion) => exclusion.employeeId)}
                onSelect={excludeBySearch}
                align="end"
              />
              {pendingSearchExclusion ? (
                <div className="rounded-lg border border-border bg-muted/30 p-2">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-xs font-medium text-foreground">
                      {pendingSearchExclusion.displayName}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setPendingSearchExclusion(null);
                        setPendingSearchReason("");
                      }}
                    >
                      {campaignPopulation.cancel}
                    </Button>
                  </div>
                  <Input
                    value={pendingSearchReason}
                    placeholder={campaignPopulation.exclusionReasonPlaceholder}
                    aria-label={campaignPopulation.exclusionReasonLabel}
                    onChange={(event) =>
                      setPendingSearchReason(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        confirmSearchExclusion();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="mt-2 w-full"
                    disabled={!pendingSearchReason.trim()}
                    onClick={confirmSearchExclusion}
                  >
                    {campaignPopulation.confirmRemove}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {orgTree.isLoading ? (
          <div className="rounded-2xl border border-border px-6 py-10 text-center text-sm text-muted-foreground">
            {campaignPopulation.treeLoading}
          </div>
        ) : (
          <PopulationScopeTree
            roots={roots}
            scopeById={scopeById}
            readOnly={readOnly}
            people={people}
            onInclude={includeUnit}
            onRemove={removeUnit}
            onToggleDescendants={setUnitDescendants}
          />
        )}
      </section>
    </div>
  );
}

// ── Readiness + launch ───────────────────────────────────────────────

export type PreflightGate = { key: string; label: string; done: boolean };

export function CampaignLaunchPad({
  campaign,
  canManage,
  canOperate,
  gates,
  onChanged,
  onNavigate,
}: {
  campaign: PerformanceCycleDetailDto;
  canManage: boolean;
  canOperate: boolean;
  gates: PreflightGate[];
  onChanged: () => Promise<unknown> | void;
  onNavigate?: (step: string) => void;
}) {
  const [showApprovers, setShowApprovers] = useState(false);
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const readiness = useApiQuery<CycleReadinessDto>(
    performanceQueryKeys.cycleReadiness(campaign.id),
    (signal) =>
      apiClient.get<CycleReadinessDto>(
        performancePaths.cycleReadiness(campaign.id),
        { signal }
      )
  );

  const [launchOpen, setLaunchOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const override = useApiMutation<
    PerformanceCycleDetailDto,
    { employeeId: string; request: OverrideParticipantApproverRequest }
  >(
    ({ employeeId, request }) =>
      apiClient.put<PerformanceCycleDetailDto>(
        performancePaths.cycleParticipantApprover(campaign.id, employeeId),
        request,
        { headers: { "If-Match": `"${campaign.version}"` } }
      ),
    {
      onSuccess: async () => {
        toast.success("Approver updated");
        await onChanged();
        await readiness.refetch();
      },
      onError: (err) => setError(messageFor(err)),
    }
  );

  const launch = useApiMutation<CampaignLaunchResultDto, void>(
    () =>
      apiClient.post<CampaignLaunchResultDto>(
        performancePaths.cycleLaunch(campaign.id),
        undefined,
        {
          headers: { "If-Match": `"${campaign.version}"` },
        }
      ),
    {
      onSuccess: async (result) => {
        setLaunchOpen(false);
        toast.success(campaignLaunch.success, {
          description: campaignLaunch.frozenSummary(
            result.frozenParticipantCount
          ),
        });
        await onChanged();
      },
      onError: (err) => {
        setError(messageFor(err));
        setLaunchOpen(false);
      },
    }
  );

  if (readiness.isLoading || !readiness.data) {
    return (
      <div className="flex flex-col gap-6" aria-busy>
        <div className="space-y-2">
          <div className="h-12 w-40 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-64 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-28 animate-pulse rounded-xl bg-muted" />
        <div className="h-14 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const data = readiness.data;
  const canLaunch = data.canLaunch;
  const missingApproverParticipants = data.participants.filter(
    (participant) => !participant.hasApprover
  );
  const missingApproverIds = new Set(
    missingApproverParticipants.map((participant) => participant.employeeId)
  );
  const missingApproverCount = missingApproverParticipants.length;
  const nonApproverBlockers = data.blockingConditions.filter(
    (condition) =>
      condition.code !== "MissingApprover" ||
      !condition.employeeId ||
      !missingApproverIds.has(condition.employeeId)
  );
  const visibleBlockers = nonApproverBlockers.slice(0, READINESS_BLOCKER_LIMIT);
  const hiddenBlockerCount = Math.max(
    0,
    nonApproverBlockers.length - visibleBlockers.length
  );
  const visibleMissingApprovers = missingApproverParticipants.slice(
    0,
    READINESS_EXCEPTION_LIMIT
  );
  const hiddenMissingApproverCount = Math.max(
    0,
    missingApproverCount - visibleMissingApprovers.length
  );
  const includedCount = data.includedCount;
  const coverageOk = missingApproverCount === 0;
  const coveredCount = Math.max(0, includedCount - missingApproverCount);
  const coveragePct =
    includedCount > 0 ? Math.round((coveredCount / includedCount) * 100) : 0;
  const openGates = gates.filter((gate) => !gate.done);
  const setupComplete = openGates.length === 0;
  const openItems =
    openGates.length + (coverageOk ? 0 : 1) + nonApproverBlockers.length;

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {setupComplete ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-heading text-5xl font-semibold leading-none tracking-tight tabular-nums text-foreground sm:text-6xl">
              {includedCount.toLocaleString()}
            </span>
            <span className="text-lg font-medium text-muted-foreground">
              {includedCount === 1
                ? campaignLaunchPad.frozenUnitOne
                : campaignLaunchPad.frozenUnit}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {campaignLaunchPad.frozenLead}
          </p>
        </div>
      ) : (
        // Setup isn't done — one hold with chips that jump back to fix it,
        // instead of a checklist and red errors restating the runway spine.
        <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-muted/20 p-4">
          <span className="text-sm font-medium text-foreground">
            {campaignLaunchPad.holdTitle}
          </span>
          <div className="flex flex-wrap gap-2">
            {openGates.map((gate) => (
              <button
                key={gate.key}
                type="button"
                onClick={() => onNavigate?.(gate.key)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CircleAlert className="size-3.5 text-muted-foreground" />
                {gate.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reviewer coverage — the signature operational readiness, as a meter.
          The gap is resolved inline; no checklist restating the runway gates. */}
      {setupComplete && includedCount > 0 ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              {coverageOk ? (
                <ShieldCheck className="size-4 text-primary" />
              ) : (
                <CircleAlert className="size-4 text-destructive" />
              )}
              {campaignLaunchPad.coverageTitle}
            </span>
            <span
              className={cn(
                "text-sm font-medium",
                coverageOk ? "text-foreground" : "text-destructive"
              )}
            >
              {coverageOk
                ? campaignLaunchPad.coverageReady
                : campaignLaunchPad.coverageGap(missingApproverCount)}
            </span>
          </div>

          <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="bg-primary transition-[width] duration-300"
              style={{ width: `${coveragePct}%` }}
            />
            {!coverageOk ? (
              <div className="flex-1 bg-destructive/25" aria-hidden />
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs tabular-nums text-muted-foreground">
              {campaignLaunchPad.coverageCovered(coveredCount)} ·{" "}
              {includedCount.toLocaleString()}
            </span>
            {!coverageOk && canManage ? (
              <Button
                type="button"
                size="sm"
                variant={showApprovers ? "ghost" : "outline"}
                onClick={() => setShowApprovers((value) => !value)}
              >
                {showApprovers
                  ? campaignLaunchPad.coverageHide
                  : campaignLaunchPad.coverageResolve}
              </Button>
            ) : null}
          </div>

          {!coverageOk && showApprovers ? (
            <div className="border-t border-border pt-3">
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                {visibleMissingApprovers.map((participant) => (
                  <ParticipantRow
                    key={participant.employeeId}
                    participant={participant}
                    canManage={canManage}
                    isBusy={override.isLoading}
                    onOverride={(request) =>
                      override.mutate({
                        employeeId: participant.employeeId,
                        request,
                      })
                    }
                  />
                ))}
              </ul>
              {hiddenMissingApproverCount > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {campaignReadinessReview.missingApproversHidden(
                    visibleMissingApprovers.length,
                    missingApproverCount
                  )}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Any remaining non-approver blockers — the message itself, no boilerplate. */}
      {setupComplete && nonApproverBlockers.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {visibleBlockers.map((condition) => (
            <li
              key={`${condition.code}-${condition.employeeId ?? "cycle"}`}
              className="flex items-start gap-2.5 text-sm"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              <span className="text-foreground">{condition.message}</span>
            </li>
          ))}
          {hiddenBlockerCount > 0 ? (
            <li className="pl-[1.625rem] text-xs text-muted-foreground">
              {campaignReadinessReview.blockingMore(hiddenBlockerCount)}
            </li>
          ) : null}
        </ul>
      ) : null}

      {/* Ignition — the verdict, then the one control that commits. */}
      {canOperate ? (
        <div className="flex flex-col gap-2">
          {setupComplete && !canLaunch && openItems > 0 ? (
            <span className="text-center text-xs font-medium text-muted-foreground">
              {campaignLaunchPad.holdCount(openItems)}
            </span>
          ) : null}
          <Button
            type="button"
            size="lg"
            disabled={!canLaunch || launch.isLoading}
            onClick={() => setLaunchOpen(true)}
            className="w-full gap-2"
          >
            <Rocket />
            {campaignLaunch.action}
          </Button>
        </div>
      ) : null}

      <LaunchDialog
        open={launchOpen}
        onOpenChange={setLaunchOpen}
        participantCount={includedCount}
        isLaunching={launch.isLoading}
        onConfirm={() => launch.mutate()}
      />
    </div>
  );
}

function ParticipantRow({
  participant,
  canManage,
  isBusy,
  onOverride,
}: {
  participant: CampaignReadinessParticipantDto;
  canManage: boolean;
  isBusy: boolean;
  onOverride: (request: OverrideParticipantApproverRequest) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [approver, setApprover] = useState<PersonOption | null>(null);
  const [reason, setReason] = useState("");

  return (
    <li className="space-y-3 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {participant.fullName}
          </span>
          {participant.jobTitle || participant.orgUnitName ? (
            <span className="block truncate text-xs text-muted-foreground">
              {[participant.jobTitle, participant.orgUnitName]
                .filter(Boolean)
                .join(" · ")}
            </span>
          ) : null}
        </span>
        <div className="flex items-center gap-2">
          {participant.hasApprover ? (
            <span className="text-right text-xs">
              <span className="block text-muted-foreground">
                {campaignReadinessReview.approver}
              </span>
              <span className="font-medium">{participant.approverName}</span>
            </span>
          ) : (
            <StatusBadge tone="warning">
              {campaignReadinessReview.missingApprover}
            </StatusBadge>
          )}
          {participant.isApproverOverridden ? (
            <Badge variant="outline">
              {campaignReadinessReview.overriddenApprover}
            </Badge>
          ) : null}
          {canManage ? (
            <Button
              type="button"
              size="sm"
              variant={participant.hasApprover ? "ghost" : "outline"}
              onClick={() => setEditing((value) => !value)}
            >
              {campaignReadinessReview.overrideAction}
            </Button>
          ) : null}
        </div>
      </div>

      {editing && canManage ? (
        <div className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1">
            <Label className="text-xs">
              {campaignReadinessReview.overrideApproverLabel}
            </Label>
            <PeopleCombobox
              value={approver}
              excludeIds={[participant.employeeId]}
              onSelect={setApprover}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">
              {campaignReadinessReview.overrideReasonLabel}
            </Label>
            <Input
              value={reason}
              placeholder={campaignReadinessReview.overrideReasonPlaceholder}
              className="h-8"
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              size="sm"
              disabled={!approver || !reason.trim() || isBusy}
              onClick={() => {
                if (!approver) return;
                onOverride({
                  approverEmployeeId: approver.employeeId,
                  reason: reason.trim(),
                });
                setEditing(false);
                setApprover(null);
                setReason("");
              }}
            >
              {isBusy
                ? campaignReadinessReview.overrideSubmitting
                : campaignReadinessReview.overrideSubmit}
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function LaunchDialog({
  open,
  onOpenChange,
  participantCount,
  isLaunching,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participantCount: number;
  isLaunching: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10">
            <Rocket className="size-5 text-primary" />
          </div>
          <DialogTitle className="text-center text-lg">
            {campaignLaunch.title}
          </DialogTitle>
          <DialogDescription className="text-center">
            {campaignLaunch.frozenSummary(participantCount)}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-center">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isLaunching}
          >
            {campaignLaunch.cancel}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isLaunching}
            className="gap-2"
          >
            <Rocket className="size-4" />
            {isLaunching ? campaignLaunch.launching : campaignLaunch.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Launched read-only baseline ──────────────────────────────────────

export function CampaignLaunchedBaseline({
  campaign,
}: {
  campaign: PerformanceCycleDetailDto;
}) {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const [search, setSearch] = useState("");
  const queryParams = { search, page: 1, pageSize: search.trim() ? 80 : 200 };
  // The launched baseline is the frozen participant snapshot — never the live
  // Draft-time resolution, which drifts as Core data changes after launch.
  const baseline = useApiQuery<PagedResponse<CycleParticipantDto>>(
    performanceQueryKeys.cycleParticipants(campaign.id, queryParams),
    (signal) =>
      apiClient.get<PagedResponse<CycleParticipantDto>>(
        performancePaths.cycleParticipants(campaign.id),
        { signal, params: queryParams }
      )
  );

  const participants = useMemo(
    () => baseline.data?.items ?? [],
    [baseline.data?.items]
  );
  const totalCount = baseline.data?.totalCount ?? campaign.participantCount;
  const searched = search.trim().length > 0;
  const approverGroups = useMemo(
    () => groupParticipantsByApprover(participants),
    [participants]
  );
  const shownGroups = approverGroups.slice(0, 6);
  const overriddenCount = participants.filter(
    (participant) => participant.isApproverOverridden
  ).length;
  const missingApproverCount = participants.filter(
    (participant) => !participant.approverName
  ).length;

  return (
    <Card size="sm">
      <CardHeader
        density="compact"
        className="grid gap-3 border-b md:grid-cols-[minmax(0,1fr)_18rem] md:items-center"
      >
        <div className="min-w-0 space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            {campaignLaunch.baselineHeading}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Review assignments frozen at launch.
          </p>
        </div>
        <label className="relative block h-8 w-full">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            placeholder="Find person"
            className="h-8 pl-8"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </CardHeader>
      <CardContent density="compact" className="space-y-4">
        {baseline.isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Loading baseline…
          </p>
        ) : participants.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {campaignLaunch.baselineEmpty}
          </p>
        ) : (
          <div className="space-y-3">
            <BaselineSummary
              managerCount={approverGroups.length}
              overrideCount={overriddenCount}
              searched={searched}
            />
            {missingApproverCount > 0 ? (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertDescription>
                  {missingApproverCount}{" "}
                  {missingApproverCount === 1
                    ? "participant has"
                    : "participants have"}{" "}
                  no approver in this view.
                </AlertDescription>
              </Alert>
            ) : null}

            {searched ? (
              <ParticipantSearchResults
                participants={participants}
                totalCount={totalCount}
              />
            ) : (
              <ApproverMap
                groups={shownGroups}
                totalManagers={approverGroups.length}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BaselineSummary({
  managerCount,
  overrideCount,
  searched,
}: {
  managerCount: number;
  overrideCount: number;
  searched: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
      <span>
        <strong className="font-semibold tabular-nums text-foreground">
          {managerCount}
        </strong>{" "}
        {searched ? "review managers found" : "review managers"}
      </span>
      <span className="hidden h-4 w-px bg-border sm:inline-block" />
      <span>
        <strong className="font-semibold tabular-nums text-foreground">
          {overrideCount}
        </strong>{" "}
        {searched ? "approver changes found" : "approver changes"}
      </span>
    </div>
  );
}

function ApproverMap({
  groups,
  totalManagers,
}: {
  groups: ApproverGroup[];
  totalManagers: number;
}) {
  return (
    <section className="space-y-3">
      <div className="grid gap-2 lg:grid-cols-2">
        {groups.map((group) => (
          <div
            key={group.approverName}
            className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border px-3 py-2.5"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {initials(group.approverName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                {group.approverName}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {campaignLaunch.assignedPeople(group.count)}
              </span>
            </span>
            <span className="text-right text-sm font-semibold tabular-nums text-foreground">
              {group.count}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {campaignLaunch.baselineGrouped(groups.length, totalManagers)}
      </p>
    </section>
  );
}

function ParticipantSearchResults({
  participants,
  totalCount,
}: {
  participants: CycleParticipantDto[];
  totalCount: number;
}) {
  if (participants.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No matching participants.
      </p>
    );
  }

  return (
    <section className="space-y-2">
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {participants.slice(0, 12).map((participant) => (
          <li
            key={participant.employeeId}
            className="grid gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,16rem)]"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">
                {participant.fullName}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {[participant.jobTitle, participant.orgUnitName]
                  .filter(Boolean)
                  .join(" · ") || participant.email}
              </span>
            </span>
            <span className="flex min-w-0 items-center justify-between gap-2 text-sm">
              <span className="truncate text-muted-foreground">
                Review manager
              </span>
              <span className="truncate font-medium text-foreground">
                {participant.approverName ?? "—"}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        {campaignLaunch.baselineSearchResults(participants.length, totalCount)}
      </p>
    </section>
  );
}

type ApproverGroup = {
  approverName: string;
  count: number;
};

function groupParticipantsByApprover(
  participants: CycleParticipantDto[]
): ApproverGroup[] {
  const groups = new Map<string, CycleParticipantDto[]>();
  for (const participant of participants) {
    const key = participant.approverName || "No approver";
    groups.set(key, [...(groups.get(key) ?? []), participant]);
  }

  return Array.from(groups.entries())
    .map(([approverName, members]) => ({
      approverName,
      count: members.length,
    }))
    .sort(
      (a, b) =>
        b.count - a.count || a.approverName.localeCompare(b.approverName)
    );
}

// ── helpers ──────────────────────────────────────────────────────────

function fromRulesScopes(campaign: PerformanceCycleDetailDto): OrgScope[] {
  return campaign.populationRules
    .filter((rule) => rule.ruleType === "OrgUnit")
    .map((rule) => ({
      orgUnitId: rule.refId,
      includeDescendants: rule.includeDescendants,
    }));
}

function fromRulesExclusions(campaign: PerformanceCycleDetailDto): Exclusion[] {
  return campaign.populationRules
    .filter((rule) => rule.ruleType === "ExcludeEmployee")
    .map((rule) => ({
      employeeId: rule.refId,
      name: null,
      reason: rule.reason ?? "",
      orgUnitId: null,
    }));
}

function toPopulationRequest(
  scopes: OrgScope[],
  exclusions: Exclusion[]
): SetCyclePopulationRequest {
  const rules: PopulationRuleInput[] = [
    ...scopes.map<PopulationRuleInput>((scope) => ({
      ruleType: "OrgUnit",
      refId: scope.orgUnitId,
      includeDescendants: scope.includeDescendants,
    })),
    ...exclusions.map<PopulationRuleInput>((exclusion) => ({
      ruleType: "ExcludeEmployee",
      refId: exclusion.employeeId,
      reason: exclusion.reason.trim(),
    })),
  ];
  return { populationIncludeInactive: false, rules };
}

function serialize(scopes: OrgScope[], exclusions: Exclusion[]): string {
  return JSON.stringify({
    scopes: [...scopes].sort((a, b) => a.orgUnitId.localeCompare(b.orgUnitId)),
    exclusions: [...exclusions]
      .map((exclusion) => ({
        employeeId: exclusion.employeeId,
        reason: exclusion.reason.trim(),
      }))
      .sort((a, b) => a.employeeId.localeCompare(b.employeeId)),
  });
}

function messageFor(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return "This campaign changed. Review the latest values and try again.";
    }
    if (error.status === 403) {
      return "You do not have permission for this action.";
    }
    return error.errors.length > 0 ? error.errors.join(" ") : error.message;
  }
  return error.message;
}
