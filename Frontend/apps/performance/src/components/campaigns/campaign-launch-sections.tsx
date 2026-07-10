"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Info,
  Plus,
  Rocket,
  ShieldCheck,
  Trash2,
  Users,
  X,
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
  type CyclePopulationPreviewDto,
  type CycleReadinessDto,
  type OverrideParticipantApproverRequest,
  type PerformanceCycleDetailDto,
  type PopulationRuleInput,
  type SetCyclePopulationRequest,
  type WorkforceOrgUnitSummaryDto,
} from "@repo/api";
import { useApiMutation, useApiQuery } from "@repo/api/query";
import { StatusBadge } from "@repo/ds/shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PeopleCombobox, type PersonOption } from "./people-combobox";
import {
  campaignLaunch,
  campaignPopulation,
  campaignReadinessReview,
} from "./campaign-terminology";

type OrgScope = { orgUnitId: string; includeDescendants: boolean };
type Exclusion = { employeeId: string; name: string | null; reason: string };

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

  const orgUnits = useApiQuery<WorkforceOrgUnitSummaryDto[]>(
    coreWorkforceQueryKeys.orgUnits(false),
    (signal) =>
      apiClient.get<WorkforceOrgUnitSummaryDto[]>(
        coreWorkforcePaths.orgUnits(),
        { signal }
      ),
    { enabled: canManage }
  );
  const orgUnitName = useMemo(() => {
    const map = new Map<string, string>();
    for (const unit of orgUnits.data ?? []) map.set(unit.id, unit.name);
    return map;
  }, [orgUnits.data]);

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

  useEffect(() => {
    setScopes(fromRulesScopes(campaign));
    setExclusions(fromRulesExclusions(campaign));
    setError(null);
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

  const isAllActive = scopes.length === 0;
  const dirty =
    serialize(scopes, exclusions) !==
    serialize(fromRulesScopes(campaign), fromRulesExclusions(campaign));
  const exclusionMissingReason = exclusions.some(
    (exclusion) => !exclusion.reason.trim()
  );
  const canSave =
    canManage && dirty && !exclusionMissingReason && !save.isLoading;

  return (
    <Card size="sm">
      <CardHeader
        density="compact"
        className="flex items-center justify-between gap-2 border-b"
      >
        <div className="space-y-0.5">
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            {campaignPopulation.title}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {campaignPopulation.description}
          </p>
        </div>
        {preview.data ? (
          <StatusBadge tone="info">
            {campaignPopulation.resolvedCount(preview.data.totalCount)}
          </StatusBadge>
        ) : null}
      </CardHeader>
      <CardContent density="compact" className="space-y-5">
        {error ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {/* Scope: explicit all-active baseline vs org-unit scopes */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">
              {campaignPopulation.scopesHeading}
            </h3>
            {!readOnly ? (
              <OrgScopePicker
                orgUnits={orgUnits.data ?? []}
                selected={scopes}
                onAdd={(orgUnitId) =>
                  setScopes((current) => [
                    ...current,
                    { orgUnitId, includeDescendants: true },
                  ])
                }
              />
            ) : null}
          </div>

          {isAllActive ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                {campaignPopulation.allActiveTitle}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {campaignPopulation.allActiveCaption}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {scopes.map((scope) => (
                <li
                  key={scope.orgUnitId}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {orgUnitName.get(scope.orgUnitId) ?? scope.orgUnitId}
                  </span>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={scope.includeDescendants}
                      disabled={readOnly}
                      onCheckedChange={(checked) =>
                        setScopes((current) =>
                          current.map((item) =>
                            item.orgUnitId === scope.orgUnitId
                              ? { ...item, includeDescendants: checked }
                              : item
                          )
                        )
                      }
                      aria-label={campaignPopulation.includeDescendants}
                    />
                    {campaignPopulation.includeDescendants}
                  </label>
                  {!readOnly ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() =>
                        setScopes((current) =>
                          current.filter(
                            (item) => item.orgUnitId !== scope.orgUnitId
                          )
                        )
                      }
                      aria-label={`${campaignPopulation.remove} ${orgUnitName.get(scope.orgUnitId) ?? scope.orgUnitId}`}
                    >
                      <X />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Exclusions — each requires a reason */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-nowrap">
              {campaignPopulation.exclusionsHeading}
            </h3>
            {!readOnly ? (
              <PeopleCombobox
                placeholder={campaignPopulation.addExclusion}
                excludeIds={exclusions.map((exclusion) => exclusion.employeeId)}
                onSelect={(person: PersonOption) =>
                  setExclusions((current) =>
                    current.some(
                      (item) => item.employeeId === person.employeeId
                    )
                      ? current
                      : [
                          ...current,
                          {
                            employeeId: person.employeeId,
                            name: person.displayName,
                            reason: "",
                          },
                        ]
                  )
                }
              />
            ) : null}
          </div>

          {exclusions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No one is excluded.</p>
          ) : (
            <ul className="space-y-2">
              {exclusions.map((exclusion) => (
                <li
                  key={exclusion.employeeId}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {exclusion.name ?? exclusion.employeeId}
                  </span>
                  <Input
                    value={exclusion.reason}
                    disabled={readOnly}
                    placeholder={campaignPopulation.exclusionReasonPlaceholder}
                    aria-label={campaignPopulation.exclusionReasonLabel}
                    aria-invalid={!exclusion.reason.trim()}
                    className={cn(
                      "h-8 w-full sm:w-64",
                      !exclusion.reason.trim() && "border-destructive"
                    )}
                    onChange={(event) =>
                      setExclusions((current) =>
                        current.map((item) =>
                          item.employeeId === exclusion.employeeId
                            ? { ...item, reason: event.target.value }
                            : item
                        )
                      )
                    }
                  />
                  {!readOnly ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() =>
                        setExclusions((current) =>
                          current.filter(
                            (item) => item.employeeId !== exclusion.employeeId
                          )
                        )
                      }
                      aria-label={`${campaignPopulation.remove} ${exclusion.name ?? exclusion.employeeId}`}
                    >
                      <Trash2 />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {exclusionMissingReason ? (
            <p className="text-xs font-medium text-destructive">
              {campaignPopulation.exclusionReasonRequired}
            </p>
          ) : null}
        </section>

        {!readOnly && dirty ? (
          <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={save.isLoading}
              onClick={() => {
                setScopes(fromRulesScopes(campaign));
                setExclusions(fromRulesExclusions(campaign));
                setError(null);
              }}
            >
              Reset
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!canSave}
              onClick={() => {
                setError(null);
                save.mutate(toPopulationRequest(scopes, exclusions));
              }}
            >
              {save.isLoading ? "Saving…" : "Save participants"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function OrgScopePicker({
  orgUnits,
  selected,
  onAdd,
}: {
  orgUnits: WorkforceOrgUnitSummaryDto[];
  selected: OrgScope[];
  onAdd: (orgUnitId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedIds = new Set(selected.map((scope) => scope.orgUnitId));
  const available = orgUnits.filter((unit) => !selectedIds.has(unit.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <Plus /> {campaignPopulation.addScope}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="max-h-72 overflow-y-auto p-1">
          {available.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No more org units.
            </p>
          ) : (
            available.map((unit) => (
              <button
                key={unit.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                style={{
                  paddingLeft: `${0.5 + Math.min(unit.level, 5) * 0.75}rem`,
                }}
                onClick={() => {
                  onAdd(unit.id);
                  setOpen(false);
                }}
              >
                <Plus
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{unit.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {unit.type}
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Readiness + launch ───────────────────────────────────────────────

export function CampaignReadinessSection({
  campaign,
  canManage,
  canOperate,
  onChanged,
}: {
  campaign: PerformanceCycleDetailDto;
  canManage: boolean;
  canOperate: boolean;
  onChanged: () => Promise<unknown> | void;
}) {
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
      <Card size="sm">
        <CardContent
          density="compact"
          className="py-10 text-center text-sm text-muted-foreground"
        >
          Checking launch readiness…
        </CardContent>
      </Card>
    );
  }

  const data = readiness.data;
  const canLaunch = data.canLaunch;

  return (
    <Card size="sm">
      <CardHeader
        density="compact"
        className="flex items-center justify-between gap-2 border-b"
      >
        <div className="space-y-0.5">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-muted-foreground" />
            {campaignReadinessReview.title}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {campaignPopulation.resolvedCount(data.includedCount)}
          </p>
        </div>
        <StatusBadge tone={canLaunch ? "success" : "warning"}>
          {canLaunch
            ? campaignReadinessReview.ready
            : campaignReadinessReview.notReady}
        </StatusBadge>
      </CardHeader>
      <CardContent density="compact" className="space-y-5">
        {error ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {/* Blocking conditions are foregrounded; informational stays quiet. */}
        {data.blockingConditions.length > 0 ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>{campaignReadinessReview.blockingHeading}</AlertTitle>
            <AlertDescription>
              <ul className="list-disc space-y-1 pl-4">
                {data.blockingConditions.map((condition) => (
                  <li
                    key={`${condition.code}-${condition.employeeId ?? "cycle"}`}
                  >
                    {condition.message}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="space-y-2">
          <h3 className="text-sm font-medium">
            {campaignReadinessReview.participantsHeading}
          </h3>
          {data.participants.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {campaignPopulation.previewEmpty}
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {data.participants.map((participant) => (
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
          )}
        </section>

        {data.informationalConditions.length > 0 ? (
          <section className="space-y-1.5">
            <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Info className="size-3.5" />
              {campaignReadinessReview.informationalHeading}
            </h3>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {data.informationalConditions.map((condition) => (
                <li
                  key={`${condition.code}-${condition.employeeId ?? "cycle"}`}
                >
                  {condition.message}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {data.exclusions.length > 0 ? (
          <section className="space-y-1.5">
            <h3 className="text-xs font-medium text-muted-foreground">
              {campaignReadinessReview.excludedHeading} (
              {data.exclusions.length})
            </h3>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {data.exclusions.map((exclusion) => (
                <li key={exclusion.employeeId}>
                  {exclusion.fullName ?? exclusion.employeeId} —{" "}
                  {exclusion.reason}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {canOperate ? (
          <div className="flex flex-col items-end gap-1.5 border-t border-border pt-4">
            <Button
              type="button"
              size="lg"
              disabled={!canLaunch || launch.isLoading}
              onClick={() => setLaunchOpen(true)}
              className="gap-2"
            >
              <Rocket className="size-4" />
              {campaignLaunch.action}
            </Button>
            {!canLaunch ? (
              <p className="text-xs text-muted-foreground">
                {campaignLaunch.blockedHint}
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>

      <LaunchDialog
        open={launchOpen}
        onOpenChange={setLaunchOpen}
        participantCount={data.includedCount}
        planningOpeningDate={campaign.planningOpeningDate}
        isLaunching={launch.isLoading}
        onConfirm={() => launch.mutate()}
      />
    </Card>
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
  planningOpeningDate,
  isLaunching,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participantCount: number;
  planningOpeningDate: string | null;
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
        <div className="space-y-1 text-center text-xs text-muted-foreground">
          <p>{campaignLaunch.irreversible}</p>
          {planningOpeningDate ? (
            <p>{campaignLaunch.scheduleNote(formatDate(planningOpeningDate))}</p>
          ) : null}
        </div>
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
  const readiness = useApiQuery<CycleReadinessDto>(
    performanceQueryKeys.cycleReadiness(campaign.id),
    (signal) =>
      apiClient.get<CycleReadinessDto>(
        performancePaths.cycleReadiness(campaign.id),
        { signal }
      )
  );

  const participants = readiness.data?.participants ?? [];

  return (
    <Card size="sm">
      <CardHeader
        density="compact"
        className="flex items-center justify-between gap-2 border-b"
      >
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          {campaignLaunch.baselineHeading}
        </CardTitle>
        <StatusBadge tone="success">
          {campaignPopulation.resolvedCount(campaign.participantCount)}
        </StatusBadge>
      </CardHeader>
      <CardContent density="compact">
        {readiness.isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Loading baseline…
          </p>
        ) : participants.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {campaignPopulation.previewEmpty}
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {participants.map((participant) => (
              <li
                key={participant.employeeId}
                className="flex items-center gap-3 px-3 py-2.5"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {participant.fullName}
                </span>
                <span className="text-right text-xs">
                  <span className="block text-muted-foreground">
                    {campaignReadinessReview.approver}
                  </span>
                  <span className="font-medium">
                    {participant.approverName ?? "—"}
                  </span>
                </span>
                {participant.isApproverOverridden ? (
                  <Badge variant="outline">
                    {campaignReadinessReview.overriddenApprover}
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value)
  );
}
