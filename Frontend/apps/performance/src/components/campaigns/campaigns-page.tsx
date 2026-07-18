"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Lock,
  Pencil,
  Plus,
  Rocket,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import {
  ApiError,
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
} from "@repo/api";
import type {
  CampaignPlanningRulesSnapshotDto,
  CampaignStrategicObjectiveDto,
  CreatePerformanceCycleRequest,
  PerformanceCycleDetailDto,
  PerformanceCycleSummaryDto,
  PerformanceCycleType,
  PagedResponse,
  ToggleCampaignStrategicObjectiveRequest,
  UpdatePerformanceCycleRequest,
  UpsertCampaignStrategicObjectiveRequest,
} from "@repo/api";
import {
  useApiMutation,
  useApiQuery,
  useApiQueryClient,
} from "@repo/api/query";
import {
  canAccessMyObjectives,
  canAccessPlanApprovals,
  canAccessTeamObjectives,
  canManagePerformanceCampaigns,
  canOperatePerformanceCycles,
  canViewPerformanceCampaigns,
  canViewPerformanceStrategy,
  useAuth,
} from "@repo/auth";
import {
  PageContainer,
  PageEmpty,
  PageError,
  PageHeader,
  PagePermissionNotice,
  StatusBadge,
} from "@repo/ds/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/controls/confirm-dialog";
import { CascadeCoverageSection } from "@/components/cascade-coverage/cascade-coverage-section";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CampaignCreateDialog } from "./campaign-create-dialog";
import {
  CampaignLaunchedBaseline,
  CampaignLaunchPad,
  CampaignPopulationSection,
  type PreflightGate,
} from "./campaign-launch-sections";
import { PlanningFlowBand } from "./planning-flow-band";
import {
  CampaignRunwaySpine,
  type RunwayStep,
  type RunwayStepKey,
} from "./campaign-setup-stepper";
import {
  campaignDiscard,
  campaignJourney,
  campaignRunway,
  campaignScheduleSteps,
  campaignStatusLabel,
  campaignStatusTone,
  campaignStrategy,
  campaignTerms,
} from "./campaign-terminology";

type DraftForm = {
  name: string;
  purpose: string;
  referenceYear: number;
  planningOpeningDate: string;
  employeeSubmissionDeadline: string;
  managerApprovalDeadline: string;
  expectedPlanningLockDate: string;
};

type ObjectiveForm = {
  title: string;
  description: string;
  responsibleFunctionLabel: string;
};

type ScheduleKey =
  | "planningOpeningDate"
  | "employeeSubmissionDeadline"
  | "managerApprovalDeadline"
  | "expectedPlanningLockDate";

const SCHEDULE_STEP_ORDER = [
  "planningOpeningDate",
  "employeeSubmissionDeadline",
  "managerApprovalDeadline",
  "expectedPlanningLockDate",
] as const satisfies readonly ScheduleKey[];

const SCHEDULE_STEPS: {
  key: ScheduleKey;
  label: string;
  caption: string;
  short: string;
}[] = SCHEDULE_STEP_ORDER.map((key) => ({
  key,
  ...campaignScheduleSteps[key],
}));

const currentYear = new Date().getFullYear();
const yearOptions = Array.from(
  { length: 5 },
  (_, index) => currentYear - 1 + index
);

const STEP_ORDER = [
  "campaign",
  "timeline",
  "strategy",
  "population",
  "launch",
] as const satisfies readonly RunwayStepKey[];

type StepState = {
  campaign: boolean;
  timeline: boolean;
  timelineError: boolean;
  strategy: boolean;
  population: boolean;
};

export function CampaignListPage() {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const canView = canViewPerformanceCampaigns(user);
  const canManage = canManagePerformanceCampaigns(user);
  const [createOpen, setCreateOpen] = useState(false);

  // Show the tenant's campaigns across their whole lifecycle — draft setup and launched alike.
  // Filtering to Draft only made a launched campaign vanish into a false "No campaigns yet" state.
  const { data, error, isLoading, refetch } = useApiQuery<
    PagedResponse<PerformanceCycleSummaryDto>
  >(
    performanceQueryKeys.cycleList({ page: 1, pageSize: 50 }),
    (signal) =>
      apiClient.get<PagedResponse<PerformanceCycleSummaryDto>>(
        performancePaths.cycles(),
        {
          signal,
          params: { page: 1, pageSize: 50 },
        }
      ),
    { enabled: canView }
  );

  if (authLoading) {
    return <CampaignListLoading />;
  }

  if (!canView) {
    return (
      <PageContainer>
        <PageHeader title={campaignTerms.listTitle} />
        <PagePermissionNotice title="Campaign access required" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={campaignTerms.listTitle}
        description="Create, launch, and track your performance planning campaigns."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus /> {campaignTerms.newTitle}
            </Button>
          ) : null
        }
      />

      {isLoading ? <CampaignGridSkeleton /> : null}
      {!isLoading && error ? (
        <PageError
          title="Could not load campaigns"
          description="Try again."
          onRetry={refetch}
        />
      ) : null}

      {!isLoading && !error && data ? (
        data.items.length === 0 ? (
          <PageEmpty
            title="No campaigns yet"
            description="Create a campaign to set its schedule, planning rules, and strategic objectives."
            action={
              canManage ? (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus /> {campaignTerms.createAction}
                </Button>
              ) : null
            }
          />
        ) : (
          <CampaignGrid campaigns={data.items} />
        )
      ) : null}

      <CampaignCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </PageContainer>
  );
}

// ── Campaign list: lifecycle-grouped work-item cards ─────────────────────────

const CAMPAIGN_TYPE_LABEL: Record<PerformanceCycleType, string> = {
  Annual: "Annual planning",
  MidYear: "Mid-year planning",
  Specific: "Specific period",
};

function CampaignGrid({
  campaigns,
}: {
  campaigns: readonly PerformanceCycleSummaryDto[];
}) {
  const groups = useMemo(() => {
    // Draft is the actionable "finish me" bucket, so it leads; closed sinks last.
    const setup: PerformanceCycleSummaryDto[] = [];
    const active: PerformanceCycleSummaryDto[] = [];
    const closed: PerformanceCycleSummaryDto[] = [];
    for (const campaign of campaigns) {
      const target =
        campaign.status === "Draft"
          ? setup
          : campaign.status === "Closed"
            ? closed
            : active;
      target.push(campaign);
    }
    const byRecency = (a: PerformanceCycleSummaryDto, b: PerformanceCycleSummaryDto) =>
      (b.referenceYear ?? 0) - (a.referenceYear ?? 0) ||
      b.createdAt.localeCompare(a.createdAt);
    for (const items of [setup, active, closed]) items.sort(byRecency);
    return [
      { key: "setup", label: "In setup", items: setup },
      { key: "active", label: "Active", items: active },
      { key: "closed", label: "Closed", items: closed },
    ].filter((bucket) => bucket.items.length > 0);
  }, [campaigns]);

  const showHeaders = groups.length > 1;

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.key} className="space-y-3">
          {showHeaders ? (
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-semibold text-foreground">{group.label}</h2>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {group.items.length}
              </span>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.items.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: PerformanceCycleSummaryDto }) {
  const locked = !!campaign.planningLockedAt;
  const isDraft = campaign.status === "Draft";
  const year =
    campaign.referenceYear ?? new Date(campaign.periodStart).getUTCFullYear();
  const urgent =
    !locked && !isDraft && campaign.status !== "Closed"
      ? campaign.deadlineState
      : "None";

  return (
    <Link
      href={`/campaigns/${campaign.slug}`}
      className="group flex flex-col rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center justify-between gap-2">
        {locked ? (
          <StatusBadge tone="neutral">
            <Lock className="size-3" /> Planning locked
          </StatusBadge>
        ) : (
          <StatusBadge tone={campaignStatusTone(campaign.status)} dot>
            {campaignStatusLabel(campaign.status)}
          </StatusBadge>
        )}
        <span className="text-sm font-medium tabular-nums text-muted-foreground">
          {year}
        </span>
      </div>

      <h3 className="mt-3 text-balance font-heading text-xl font-semibold leading-snug tracking-tight text-foreground">
        {campaign.name}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {CAMPAIGN_TYPE_LABEL[campaign.type]}
      </p>

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-4">
        {isDraft ? (
          <span className="text-sm font-medium text-primary">Continue setup</span>
        ) : (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" />
              <span className="font-semibold tabular-nums text-foreground">
                {campaign.participantCount}
              </span>
              participants
            </span>
            {urgent === "Overdue" ? (
              <StatusBadge tone="danger">Overdue</StatusBadge>
            ) : urgent === "DueSoon" ? (
              <StatusBadge tone="warning">Due soon</StatusBadge>
            ) : null}
          </span>
        )}
        <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

/**
 * Full list-loading frame: header placeholder + the card-grid skeleton. Shared by
 * the route-level `loading.tsx` and the page's own auth/data loading states so a
 * navigation shows ONE skeleton shape end to end — no flat-rows flash before the grid.
 */
export function CampaignListLoading() {
  return (
    <PageContainer>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      <CampaignGridSkeleton />
    </PageContainer>
  );
}

export function CampaignGridSkeleton() {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      aria-busy
      aria-label="Loading campaigns"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-4 w-10" />
          </div>
          <Skeleton className="mt-3 h-6 w-3/4" />
          <Skeleton className="mt-2 h-4 w-32" />
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="size-5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CampaignDraftPage() {
  const params = useParams<{ slug?: string }>();
  const slug = params.slug ?? "";
  const router = useRouter();
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const canView = canViewPerformanceCampaigns(user);
  const canManage = canManagePerformanceCampaigns(user);
  const canOperate = canOperatePerformanceCycles(user);
  const canAccessMine = canAccessMyObjectives(user);
  const canAccessTeam = canAccessTeamObjectives(user);
  const canAccessApprovals = canAccessPlanApprovals(user);
  const canViewStrategy = canViewPerformanceStrategy(user);
  const [form, setForm] = useState<DraftForm | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [objectiveForm, setObjectiveForm] = useState<ObjectiveForm>(() =>
    emptyObjectiveForm()
  );
  const [editingObjectiveId, setEditingObjectiveId] = useState<string | null>(
    null
  );
  const [isAdding, setIsAdding] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<RunwayStepKey>("campaign");
  const stepInitializedFor = useRef<string | null>(null);

  const {
    data: campaign,
    error,
    isLoading,
    refetch,
  } = useApiQuery<PerformanceCycleDetailDto>(
    performanceQueryKeys.cycleBySlug(slug),
    (signal) =>
      apiClient.get<PerformanceCycleDetailDto>(
        performancePaths.cycleBySlug(slug),
        { signal }
      ),
    { enabled: canView && !!slug }
  );

  const campaignId = campaign?.id ?? "";

  useEffect(() => {
    if (campaign) {
      setForm(fromCampaign(campaign));
      setErrors([]);
      setEditingObjectiveId(null);
      setIsAdding(false);
      setObjectiveForm(emptyObjectiveForm());
    }
  }, [campaign]);

  // Land on the first unfinished gate the first time a campaign loads — but only
  // once per campaign, so a save-triggered refetch never yanks the user's step.
  useEffect(() => {
    if (!campaign || campaign.status !== "Draft") return;
    if (stepInitializedFor.current === campaign.id) return;
    stepInitializedFor.current = campaign.id;
    setActiveStep(firstOpenStep(fromCampaign(campaign), campaign));
  }, [campaign]);

  const update = useApiMutation<
    PerformanceCycleDetailDto,
    UpdatePerformanceCycleRequest
  >(
    (request) =>
      apiClient.put<PerformanceCycleDetailDto>(
        performancePaths.cycle(campaignId),
        request,
        {
          headers: { "If-Match": `"${campaign?.version ?? 0}"` },
        }
      ),
    {
      onSuccess: async () => {
        toast.success("Campaign saved");
        await refetch();
      },
      onError: (error) => setErrors(errorToMessages(error)),
    }
  );

  const addObjective = useApiMutation<
    CampaignStrategicObjectiveDto,
    UpsertCampaignStrategicObjectiveRequest
  >(
    (request) =>
      apiClient.post<CampaignStrategicObjectiveDto>(
        performancePaths.campaignStrategicObjectives(campaignId),
        request
      ),
    {
      onSuccess: async () => {
        toast.success("Strategic objective added");
        setObjectiveForm(emptyObjectiveForm());
        setIsAdding(false);
        await refetch();
      },
      onError: (error) => setErrors(errorToMessages(error)),
    }
  );

  const updateObjective = useApiMutation<
    CampaignStrategicObjectiveDto,
    {
      objective: CampaignStrategicObjectiveDto;
      request: UpsertCampaignStrategicObjectiveRequest;
    }
  >(
    ({ objective, request }) =>
      apiClient.put<CampaignStrategicObjectiveDto>(
        performancePaths.campaignStrategicObjective(campaignId, objective.id),
        request,
        { headers: { "If-Match": `"${objective.version}"` } }
      ),
    {
      onSuccess: async () => {
        toast.success("Strategic objective saved");
        setEditingObjectiveId(null);
        setObjectiveForm(emptyObjectiveForm());
        await refetch();
      },
      onError: (error) => setErrors(errorToMessages(error)),
    }
  );

  const toggleObjective = useApiMutation<
    CampaignStrategicObjectiveDto,
    {
      objective: CampaignStrategicObjectiveDto;
      request: ToggleCampaignStrategicObjectiveRequest;
    }
  >(
    ({ objective, request }) =>
      apiClient.put<CampaignStrategicObjectiveDto>(
        performancePaths.campaignStrategicObjectiveActiveState(
          campaignId,
          objective.id
        ),
        request,
        { headers: { "If-Match": `"${objective.version}"` } }
      ),
    {
      onSuccess: async () => {
        await refetch();
      },
      onError: (error) => setErrors(errorToMessages(error)),
    }
  );

  const discard = useApiMutation<void, void>(
    () =>
      apiClient.delete<void>(performancePaths.cycle(campaignId), {
        headers: { "If-Match": `"${campaign?.version ?? 0}"` },
      }),
    {
      onSuccess: () => {
        // Refresh the list only — invalidating the cycles() base would also refetch the
        // still-mounted by-slug detail query for the just-deleted campaign (a stray 404).
        queryClient.invalidateQueries({
          queryKey: [...performanceQueryKeys.cycles(), "list"],
        });
        toast.success(campaignDiscard.success);
        router.push("/campaigns");
      },
      onError: (error) => {
        setDiscardOpen(false);
        setErrors(errorToMessages(error));
      },
    }
  );

  if (authLoading) {
    return <CampaignPageSkeleton />;
  }

  if (!canView) {
    return (
      <PageContainer>
        <PageHeader title={campaignTerms.setupTitle} />
        <PagePermissionNotice title="Campaign access required" />
      </PageContainer>
    );
  }

  if (isLoading || !form) {
    return <CampaignPageSkeleton />;
  }

  if (error || !campaign) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <PageContainer>
        <PageError
          title={notFound ? "Campaign not found" : "Could not load campaign"}
          description={
            notFound
              ? "It may have been removed, or the link is wrong."
              : "Try again."
          }
          onRetry={notFound ? undefined : refetch}
        />
      </PageContainer>
    );
  }

  const isDraft = campaign.status === "Draft";
  const localErrors = validateDraftForm(form);
  const isDirty =
    serializeDraftForm(form) !== serializeDraftForm(fromCampaign(campaign));
  const readOnly = !canManage || !isDraft;
  const canDiscard = canManage && isDraft;
  const objectiveRequest = toObjectiveRequest(objectiveForm);

  // Applied population/approver/launch changes must reflect immediately: refetch the campaign
  // detail and invalidate its live sub-queries (population preview, readiness) without a manual refresh.
  const handleWorkspaceChange = async () => {
    await refetch();
    await queryClient.invalidateQueries({
      queryKey: performanceQueryKeys.cycle(campaignId),
    });
  };

  const baseline = fromCampaign(campaign);
  const campaignDirty =
    form.name !== baseline.name ||
    form.purpose !== baseline.purpose ||
    form.referenceYear !== baseline.referenceYear;
  const timelineDirty = SCHEDULE_STEP_ORDER.some(
    (key) => form[key] !== baseline[key]
  );

  const stepState = getStepState(form, campaign);
  const gatesCleared =
    stepState.campaign &&
    stepState.timeline &&
    stepState.strategy &&
    stepState.population;

  const steps: RunwayStep[] = [
    {
      key: "campaign",
      label: campaignRunway.steps.campaign.label,
      icon: ClipboardCheck,
      done: stepState.campaign,
      unsaved: campaignDirty,
    },
    {
      key: "timeline",
      label: campaignRunway.steps.timeline.label,
      icon: CalendarDays,
      done: stepState.timeline,
      hasError: stepState.timelineError,
      unsaved: timelineDirty,
    },
    {
      key: "strategy",
      label: campaignRunway.steps.strategy.label,
      icon: Target,
      done: stepState.strategy,
    },
    {
      key: "population",
      label: campaignRunway.steps.population.label,
      icon: Users,
      done: stepState.population,
    },
    {
      key: "launch",
      label: campaignRunway.steps.launch.label,
      icon: Rocket,
      done: gatesCleared,
    },
  ];

  const preflightGates: PreflightGate[] = [
    {
      key: "campaign",
      label: campaignRunway.steps.campaign.label,
      done: stepState.campaign,
    },
    {
      key: "timeline",
      label: campaignRunway.steps.timeline.label,
      done: stepState.timeline,
    },
    {
      key: "strategy",
      label: campaignRunway.steps.strategy.label,
      done: stepState.strategy,
    },
    {
      key: "population",
      label: campaignRunway.steps.population.label,
      done: stepState.population,
    },
  ];

  const activeIndex = STEP_ORDER.indexOf(activeStep);
  const isFirstStep = activeIndex === 0;
  const isLastStep = activeIndex === STEP_ORDER.length - 1;

  // No explicit save: leaving a dirty, valid Campaign/Timeline step persists it
  // in the background. Population and Strategy autosave their own changes.
  const commitDraft = () => {
    if (
      canManage &&
      isDraft &&
      isDirty &&
      localErrors.length === 0 &&
      (activeStep === "campaign" || activeStep === "timeline")
    ) {
      setErrors([]);
      update.mutate(toDraftRequest(form));
    }
  };
  const navigateTo = (step: RunwayStepKey) => {
    if (step !== activeStep) commitDraft();
    setActiveStep(step);
  };
  const goNext = () =>
    navigateTo(STEP_ORDER[Math.min(activeIndex + 1, STEP_ORDER.length - 1)]!);
  const goBack = () => navigateTo(STEP_ORDER[Math.max(activeIndex - 1, 0)]!);

  const activeStepMeta = steps[activeIndex]!;
  const ActiveIcon = activeStepMeta.icon;

  return (
    <PageContainer>
      <PageHeader
        title={campaign.name}
        eyebrow={
          <div className="flex items-center gap-2">
            <StatusBadge tone={campaignStatusTone(campaign.status)}>
              {campaignStatusLabel(campaign.status)}
            </StatusBadge>
            <span className="font-mono text-xs text-muted-foreground">
              {campaign.slug}
            </span>
          </div>
        }
        description={
          campaign.ownerName ? `Owned by ${campaign.ownerName}` : undefined
        }
        actions={
          !isDraft ? (
            <Button asChild size="sm">
              <Link href={`/campaigns/${campaign.slug}/completion`}>
                <Lock />
                Planning completion
              </Link>
            </Button>
          ) : canDiscard ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setDiscardOpen(true)}
            >
              <Trash2 /> {campaignDiscard.action}
            </Button>
          ) : readOnly ? (
            <Badge variant="outline">Read only</Badge>
          ) : null
        }
      />

      {errors.length > 0 ? (
        <div className="mb-5">
          <CampaignErrorList errors={errors} />
        </div>
      ) : null}

      {isDraft ? (
        <div className="flex flex-col gap-5">
          <CampaignRunwaySpine
            steps={steps}
            active={activeStep}
            cleared={gatesCleared}
            onSelect={navigateTo}
          />

          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ActiveIcon className="size-5" />
                </span>
                <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
                  {activeStepMeta.label}
                </h2>
              </div>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                Step {activeIndex + 1} / {STEP_ORDER.length}
              </span>
            </header>

            <div className="px-5 py-6 sm:px-6">
              {activeStep === "campaign" ? (
                <CampaignStep
                  form={form}
                  onChange={setForm}
                  disabled={readOnly || update.isLoading}
                  snapshot={campaign.planningRulesSnapshot}
                />
              ) : null}

              {activeStep === "timeline" ? (
                <PlanningJourney
                  form={form}
                  onChange={setForm}
                  disabled={readOnly || update.isLoading}
                />
              ) : null}

              {activeStep === "strategy" ? (
                <ObjectivesSection
                  objectives={campaign.strategicObjectives}
                  readOnly={readOnly}
                  objectiveForm={objectiveForm}
                  objectiveRequest={objectiveRequest}
                  editingObjectiveId={editingObjectiveId}
                  isAdding={isAdding}
                  isBusy={addObjective.isLoading || updateObjective.isLoading}
                  isToggling={toggleObjective.isLoading}
                  onObjectiveFormChange={setObjectiveForm}
                  onStartAdd={() => {
                    setEditingObjectiveId(null);
                    setObjectiveForm(emptyObjectiveForm());
                    setIsAdding(true);
                  }}
                  onCancelAdd={() => {
                    setIsAdding(false);
                    setObjectiveForm(emptyObjectiveForm());
                  }}
                  onSubmitAdd={() => addObjective.mutate(objectiveRequest)}
                  onStartEdit={(objective) => {
                    setIsAdding(false);
                    setEditingObjectiveId(objective.id);
                    setObjectiveForm(fromObjective(objective));
                  }}
                  onCancelEdit={() => {
                    setEditingObjectiveId(null);
                    setObjectiveForm(emptyObjectiveForm());
                  }}
                  onSubmitEdit={(objective) =>
                    updateObjective.mutate({
                      objective,
                      request: objectiveRequest,
                    })
                  }
                  onToggle={(objective, isActive) =>
                    toggleObjective.mutate({
                      objective,
                      request: { isActive },
                    })
                  }
                />
              ) : null}

              {activeStep === "population" ? (
                <CampaignPopulationSection
                  campaign={campaign}
                  canManage={canManage}
                  onSaved={handleWorkspaceChange}
                />
              ) : null}

              {activeStep === "launch" ? (
                <CampaignLaunchPad
                  campaign={campaign}
                  canManage={canManage}
                  canOperate={canOperate}
                  gates={preflightGates}
                  onChanged={handleWorkspaceChange}
                  onNavigate={(step) => setActiveStep(step as RunwayStepKey)}
                />
              ) : null}
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-4 sm:px-6">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={goBack}
                disabled={isFirstStep}
              >
                <ChevronLeft /> Back
              </Button>
              {!isLastStep ? (
                <Button type="button" size="sm" onClick={goNext}>
                  Next <ChevronRight />
                </Button>
              ) : null}
            </footer>
          </section>
        </div>
      ) : (
        <LaunchedCampaignWorkspace
          campaign={campaign}
          form={form}
          canAccessMine={canAccessMine}
          canAccessTeam={canAccessTeam}
          canAccessApprovals={canAccessApprovals}
          canViewStrategy={canViewStrategy}
          canViewCompletion={canView}
        />
      )}

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title={campaignDiscard.title}
        description={campaignDiscard.description}
        confirmLabel={campaignDiscard.confirm}
        cancelLabel={campaignDiscard.cancel}
        destructive
        onConfirm={() => discard.mutate()}
      />
    </PageContainer>
  );
}

function getStepState(
  form: DraftForm,
  campaign: PerformanceCycleDetailDto
): StepState {
  const scheduleDates = SCHEDULE_STEPS.map((step) => form[step.key]);
  const scheduleComplete = scheduleDates.every(Boolean);
  const scheduleOrdered =
    scheduleComplete &&
    scheduleDates.every(
      (value, index) => index === 0 || (scheduleDates[index - 1] ?? "") <= value
    );
  const timelineError = scheduleDates.some(
    (value, index) =>
      index > 0 && !!value && value < (scheduleDates[index - 1] ?? "")
  );
  const activeObjectiveCount = campaign.strategicObjectives.filter(
    (objective) => objective.isActive
  ).length;
  const hasPopulationScope = campaign.populationRules.some(
    (rule) => rule.ruleType === "OrgUnit" || rule.ruleType === "IncludeEmployee"
  );

  return {
    campaign: !!form.name.trim() && !!form.referenceYear,
    timeline: scheduleComplete && scheduleOrdered,
    timelineError,
    strategy: activeObjectiveCount > 0,
    population: hasPopulationScope,
  };
}

function firstOpenStep(
  form: DraftForm,
  campaign: PerformanceCycleDetailDto
): RunwayStepKey {
  const state = getStepState(form, campaign);
  if (!state.campaign) return "campaign";
  if (!state.timeline) return "timeline";
  if (!state.strategy) return "strategy";
  if (!state.population) return "population";
  return "launch";
}

function LaunchedCampaignWorkspace({
  campaign,
  form,
  canAccessMine,
  canAccessTeam,
  canAccessApprovals,
  canViewStrategy,
  canViewCompletion,
}: {
  campaign: PerformanceCycleDetailDto;
  form: DraftForm;
  canAccessMine: boolean;
  canAccessTeam: boolean;
  canAccessApprovals: boolean;
  canViewStrategy: boolean;
  canViewCompletion: boolean;
}) {
  return (
    <div className="space-y-5">
      <LaunchedCampaignSummary campaign={campaign} form={form} />
      <PlanningFlowBand
        slug={campaign.slug}
        planningOpeningDate={form.planningOpeningDate || null}
        locked={!!campaign.planningLockedAt}
        access={{
          canViewStrategy,
          canAccessTeam,
          canAccessMine,
          canAccessApprovals,
          canViewCompletion,
          // Read-model gates mirror the backend: cascade coverage is readable by
          // strategy viewers or campaign viewers; planning completion by campaign
          // viewers. The launched detail is campaign-viewer-only, so HR reads both.
          canReadCascade: canViewStrategy || canViewCompletion,
          canReadCompletion: canViewCompletion,
        }}
      />
      <CascadeCoverageSection slug={campaign.slug} />
      <CampaignLaunchedBaseline campaign={campaign} />
    </div>
  );
}

function LaunchedCampaignSummary({
  campaign,
  form,
}: {
  campaign: PerformanceCycleDetailDto;
  form: DraftForm;
}) {
  const activeObjectives = campaign.strategicObjectives.filter(
    (objective) => objective.isActive
  );
  const locked = !!campaign.planningLockedAt;
  const stateLabel = locked ? "Planning locked" : "Baseline frozen";
  const stateDate = locked
    ? campaign.planningLockedAt
      ? formatDate(campaign.planningLockedAt)
      : "Locked"
    : campaign.launchedAt
      ? formatDate(campaign.launchedAt)
      : "Launched";

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="space-y-4">
        <div className="min-w-0 space-y-2">
          <div className="flex">
            <div className="space-y-1">
              <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
                Campaign baseline
              </h2>
              {form.purpose ? (
                <p className="max-w-3xl text-sm text-muted-foreground">
                  {form.purpose}
                </p>
              ) : null}
            </div>
            <StatusBadge
              className="ml-auto"
              tone={locked ? "neutral" : "success"}
            >
              {stateLabel}
            </StatusBadge>
          </div>
        </div>

        <div className="grid gap-x-6 gap-y-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <LaunchFact
            label="People"
            value={String(campaign.participantCount)}
            emphasis
          />
          <LaunchFact
            label={locked ? "Locked" : "Launched"}
            value={stateDate}
          />
          <LaunchFact label="Year" value={String(form.referenceYear)} />
          <LaunchFact
            label="Strategic goals"
            value={`${activeObjectives.length}/${campaign.strategicObjectives.length}`}
          />
        </div>

        <PlanningTimeline form={form} />
      </div>
    </section>
  );
}

function LaunchFact({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 truncate font-semibold text-foreground",
          emphasis
            ? "font-heading text-2xl leading-none tracking-tight tabular-nums"
            : "text-sm"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function PlanningTimeline({ form }: { form: DraftForm }) {
  return (
    <section className="border-t border-border pt-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <h2 className="shrink-0 text-sm font-semibold text-foreground lg:w-36">
          Planning timeline
        </h2>
        <ol className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {SCHEDULE_STEPS.map((step) => (
            <TimelineStep
              key={step.key}
              label={campaignScheduleSteps[step.key].short}
              value={formatDate(form[step.key])}
            />
          ))}
        </ol>
      </div>
    </section>
  );
}

function TimelineStep({ label, value }: { label: string; value: string }) {
  return (
    <li className="grid min-w-0 grid-cols-[0.625rem_minmax(0,1fr)] gap-2 py-1">
      <span className="mt-1.5 size-2 rounded-full bg-primary" aria-hidden />
      <span className="min-w-0">
        <span className="block truncate text-xs text-muted-foreground">
          {label}
        </span>
        <span className="block truncate text-sm font-semibold tabular-nums text-foreground">
          {value}
        </span>
      </span>
    </li>
  );
}

function CampaignStep({
  form,
  onChange,
  disabled,
  snapshot,
}: {
  form: DraftForm;
  onChange: (form: DraftForm) => void;
  disabled: boolean;
  snapshot: CampaignPlanningRulesSnapshotDto | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      <IdentityFields form={form} onChange={onChange} disabled={disabled} />
      <PlanningPolicyStrip snapshot={snapshot} />
    </div>
  );
}

function PlanningPolicyStrip({
  snapshot,
}: {
  snapshot: CampaignPlanningRulesSnapshotDto | null;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-muted/20">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Lock className="size-3.5 text-muted-foreground" />
          {campaignTerms.rules}
        </span>
        {snapshot ? <Badge variant="outline">Captured</Badge> : null}
      </header>
      {snapshot ? (
        <dl className="grid gap-x-6 gap-y-4 px-4 py-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">
              Maximum objectives
            </dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">
              {snapshot.maxObjectiveCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Allowed weights</dt>
            <dd className="mt-1.5">
              <ChipList values={parseWeights(snapshot.allowedWeightMenu)} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Measurement methods
            </dt>
            <dd className="mt-1.5">
              <ChipList
                values={parseMeasurementMethods(
                  snapshot.enabledMeasurementMethods
                )}
              />
            </dd>
          </div>
        </dl>
      ) : (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          No policy captured.
        </p>
      )}
    </section>
  );
}

function IdentityFields({
  form,
  onChange,
  disabled,
}: {
  form: DraftForm;
  onChange: (form: DraftForm) => void;
  disabled: boolean;
}) {
  return (
    <section className="min-w-0">
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <Field label="Campaign name">
          <Input
            value={form.name}
            disabled={disabled}
            placeholder="e.g. FY26 Annual Planning"
            onChange={(event) =>
              onChange({ ...form, name: event.target.value })
            }
          />
        </Field>
        <Field label="Reference year">
          <NativeSelect
            className="w-full [color-scheme:light] dark:[color-scheme:dark]"
            value={String(form.referenceYear)}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...form, referenceYear: Number(event.target.value) })
            }
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Purpose" optional className="sm:col-span-2">
          <Textarea
            value={form.purpose}
            disabled={disabled}
            rows={2}
            placeholder="What this campaign is for."
            onChange={(event) =>
              onChange({ ...form, purpose: event.target.value })
            }
          />
        </Field>
      </div>
    </section>
  );
}

type Milestone = {
  step: (typeof SCHEDULE_STEPS)[number];
  value: string;
  outOfOrder: boolean;
  gapFromPrev: number | null;
  prevShort: string | null;
  index: number;
};

function buildMilestones(form: DraftForm): Milestone[] {
  return SCHEDULE_STEPS.map((step, index) => {
    const value = form[step.key];
    const prevStep = index > 0 ? SCHEDULE_STEPS[index - 1]! : null;
    const prev = prevStep ? form[prevStep.key] : "";
    const outOfOrder = !!value && !!prev && value < prev;
    return {
      step,
      value,
      outOfOrder,
      gapFromPrev: value && prev && !outOfOrder ? dayGap(prev, value) : null,
      prevShort: prevStep?.short ?? null,
      index,
    };
  });
}

/**
 * The campaign's planning dates read as a journey: four milestones with the
 * windows (in days) that open between them. The span the whole thing covers is
 * the lead figure; each gap tells the reader how long that phase lasts.
 */
function PlanningJourney({
  form,
  onChange,
  disabled,
}: {
  form: DraftForm;
  onChange: (form: DraftForm) => void;
  disabled: boolean;
}) {
  const milestones = buildMilestones(form);
  const first = form[SCHEDULE_STEPS[0]!.key];
  const last = form[SCHEDULE_STEPS[SCHEDULE_STEPS.length - 1]!.key];
  const spanValid = !!first && !!last && first <= last;
  const spanDays = spanValid ? dayGap(first, last) : null;

  const dateInput = (milestone: Milestone) => (
    <Input
      type="date"
      aria-label={milestone.step.label}
      value={milestone.value}
      disabled={disabled}
      aria-invalid={milestone.outOfOrder}
      className={cn(
        "w-full [color-scheme:light] dark:[color-scheme:dark]",
        milestone.outOfOrder && "border-destructive"
      )}
      onChange={(event) =>
        onChange({ ...form, [milestone.step.key]: event.target.value })
      }
    />
  );

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-baseline gap-2">
        <span className="font-heading text-4xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
          {spanDays ?? "—"}
        </span>
        <span className="text-sm text-muted-foreground">
          {spanDays !== null
            ? `${campaignJourney.spanUnit} · ${campaignJourney.spanLead}`
            : campaignJourney.spanEmpty}
        </span>
      </div>

      {/* Desktop: the journey runs left-to-right, windows sitting on the rail. */}
      <ol className="hidden grid-cols-4 md:grid">
        {milestones.map((milestone) => {
          const next = milestones[milestone.index + 1];
          const connectorFilled =
            !!milestone.value &&
            !!next?.value &&
            !next.outOfOrder &&
            !milestone.outOfOrder;
          const nextGap = next?.gapFromPrev ?? null;
          return (
            <li
              key={milestone.step.key}
              className="relative flex flex-col items-center px-1.5"
            >
              {next ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-1/2 top-[0.4375rem] h-0.5 w-full",
                    next.outOfOrder
                      ? "bg-destructive/40"
                      : connectorFilled
                        ? "bg-primary"
                        : "bg-border"
                  )}
                />
              ) : null}
              {nextGap !== null ? (
                <span className="absolute left-full top-[0.4375rem] z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-border bg-card px-1.5 py-0.5 text-[0.6875rem] font-medium tabular-nums text-muted-foreground">
                  {campaignJourney.gapDays(nextGap)}
                </span>
              ) : null}
              <span
                className={cn(
                  "relative z-10 size-4 rounded-full ring-4 ring-card transition-colors",
                  milestone.outOfOrder
                    ? "bg-destructive"
                    : milestone.value
                      ? "bg-primary"
                      : "border-2 border-muted-foreground/40 bg-background"
                )}
              />
              <div className="mt-4 flex w-full flex-col items-center gap-2 text-center">
                <span className="text-xs font-medium leading-tight text-balance text-foreground">
                  {milestone.step.label}
                </span>
                {dateInput(milestone)}
                {milestone.outOfOrder && milestone.prevShort ? (
                  <span className="text-xs font-medium text-destructive">
                    {campaignJourney.mustFollow(milestone.prevShort)}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Mobile: the same journey stacked, windows on the connector. */}
      <ol className="flex flex-col md:hidden">
        {milestones.map((milestone) => {
          const isLast = milestone.index === milestones.length - 1;
          return (
            <li
              key={milestone.step.key}
              className="grid grid-cols-[1rem_1fr] gap-x-3"
            >
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "mt-1.5 size-3.5 rounded-full transition-colors",
                    milestone.outOfOrder
                      ? "bg-destructive"
                      : milestone.value
                        ? "bg-primary"
                        : "border-2 border-muted-foreground/40 bg-background"
                  )}
                />
                {!isLast ? (
                  <span
                    className={cn(
                      "w-0.5 flex-1",
                      milestone.outOfOrder ? "bg-destructive/40" : "bg-border"
                    )}
                  />
                ) : null}
              </div>
              <div className={cn("min-w-0", isLast ? "pb-0" : "pb-5")}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="text-sm font-medium text-foreground">
                    {milestone.step.label}
                  </span>
                  {milestone.gapFromPrev !== null ? (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      +{campaignJourney.gapDays(milestone.gapFromPrev)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2">{dateInput(milestone)}</div>
                {milestone.outOfOrder && milestone.prevShort ? (
                  <p className="mt-1.5 text-xs font-medium text-destructive">
                    {campaignJourney.mustFollow(milestone.prevShort)}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ObjectivesSection({
  objectives,
  readOnly,
  objectiveForm,
  objectiveRequest,
  editingObjectiveId,
  isAdding,
  isBusy,
  isToggling,
  onObjectiveFormChange,
  onStartAdd,
  onCancelAdd,
  onSubmitAdd,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  onToggle,
}: {
  objectives: CampaignStrategicObjectiveDto[];
  readOnly: boolean;
  objectiveForm: ObjectiveForm;
  objectiveRequest: UpsertCampaignStrategicObjectiveRequest;
  editingObjectiveId: string | null;
  isAdding: boolean;
  isBusy: boolean;
  isToggling: boolean;
  onObjectiveFormChange: (form: ObjectiveForm) => void;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onSubmitAdd: () => void;
  onStartEdit: (objective: CampaignStrategicObjectiveDto) => void;
  onCancelEdit: () => void;
  onSubmitEdit: (objective: CampaignStrategicObjectiveDto) => void;
  onToggle: (
    objective: CampaignStrategicObjectiveDto,
    isActive: boolean
  ) => void;
}) {
  const activeCount = objectives.filter(
    (objective) => objective.isActive
  ).length;
  const isEmpty = objectives.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {isEmpty ? (
          <span className="text-sm text-muted-foreground">
            {campaignStrategy.addFirst}
          </span>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-4xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
              {activeCount}
            </span>
            <span className="text-sm text-muted-foreground">
              {campaignStrategy.activeUnit} ·{" "}
              {campaignStrategy.ofTotal(objectives.length)}
            </span>
          </div>
        )}
        {!readOnly && !isAdding ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onStartAdd}
          >
            <Plus /> {campaignStrategy.addAction}
          </Button>
        ) : null}
      </div>

      {isEmpty && !isAdding ? (
        <button
          type="button"
          onClick={readOnly ? undefined : onStartAdd}
          disabled={readOnly}
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12 text-center transition-colors hover:border-primary/50 hover:bg-muted/30 disabled:cursor-default disabled:hover:border-border disabled:hover:bg-transparent"
        >
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Target className="size-6" />
          </span>
          <span className="text-sm font-medium text-foreground">
            {campaignStrategy.addFirst}
          </span>
        </button>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {isAdding ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-primary/[0.03] p-4 sm:col-span-2 xl:col-span-3">
              <ObjectiveEditor
                form={objectiveForm}
                onChange={onObjectiveFormChange}
                disabled={isBusy}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={onCancelAdd}
                  disabled={isBusy}
                >
                  {campaignStrategy.cancel}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={onSubmitAdd}
                  disabled={!objectiveRequest.title || isBusy}
                >
                  <Plus /> {campaignStrategy.addAction}
                </Button>
              </div>
            </div>
          ) : null}

          {objectives.map((objective) => {
            const isEditing = editingObjectiveId === objective.id;
            if (isEditing) {
              return (
                <div
                  key={objective.id}
                  className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-primary/[0.03] p-4 sm:col-span-2 xl:col-span-3"
                >
                  <ObjectiveEditor
                    form={objectiveForm}
                    onChange={onObjectiveFormChange}
                    disabled={isBusy}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={onCancelEdit}
                      disabled={isBusy}
                    >
                      {campaignStrategy.cancel}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onSubmitEdit(objective)}
                      disabled={!objectiveRequest.title || isBusy}
                    >
                      {campaignStrategy.saveObjective}
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={objective.id}
                className={cn(
                  "flex flex-col gap-3 rounded-2xl border p-4 transition-colors",
                  objective.isActive
                    ? "border-border bg-card"
                    : "border-dashed border-border bg-muted/20"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  {objective.responsibleFunctionLabel ? (
                    <Badge variant="outline" className="max-w-full truncate">
                      {objective.responsibleFunctionLabel}
                    </Badge>
                  ) : (
                    <span />
                  )}
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 text-xs font-medium",
                      objective.isActive
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        objective.isActive
                          ? "bg-primary"
                          : "bg-muted-foreground"
                      )}
                    />
                    {objective.isActive
                      ? campaignStrategy.active
                      : campaignStrategy.paused}
                  </span>
                </div>

                <h3
                  className={cn(
                    "font-heading text-base font-semibold leading-snug tracking-tight",
                    objective.isActive
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {objective.title}
                </h3>
                {objective.description ? (
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {objective.description}
                  </p>
                ) : null}

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
                  <Switch
                    checked={objective.isActive}
                    disabled={readOnly || isToggling}
                    onCheckedChange={(isActive) =>
                      onToggle(objective, isActive)
                    }
                    aria-label={`${objective.isActive ? "Deactivate" : "Activate"} ${objective.title}`}
                  />
                  {!readOnly ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onStartEdit(objective)}
                      aria-label={campaignStrategy.editLabel(objective.title)}
                    >
                      <Pencil />
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ObjectiveEditor({
  form,
  onChange,
  disabled,
  autoFocus,
}: {
  form: ObjectiveForm;
  onChange: (form: ObjectiveForm) => void;
  disabled: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Title" className="sm:col-span-2">
        <Input
          value={form.title}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder="e.g. Grow client satisfaction"
          onChange={(event) => onChange({ ...form, title: event.target.value })}
        />
      </Field>
      <Field label="Description" optional className="sm:col-span-2">
        <Textarea
          value={form.description}
          disabled={disabled}
          rows={2}
          onChange={(event) =>
            onChange({ ...form, description: event.target.value })
          }
        />
      </Field>
      <Field label="Responsible function" optional className="sm:col-span-2">
        <Input
          value={form.responsibleFunctionLabel}
          disabled={disabled}
          placeholder="e.g. Consulting"
          onChange={(event) =>
            onChange({ ...form, responsibleFunctionLabel: event.target.value })
          }
        />
      </Field>
    </div>
  );
}

function ChipList({ values }: { values: string[] }) {
  if (values.length === 0) {
    return <p className="text-sm text-muted-foreground">—</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <span
          key={value}
          className="inline-flex items-center rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-xs font-medium text-foreground"
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function CampaignErrorList({ errors }: { errors: string[] }) {
  return (
    <Alert variant="destructive">
      <AlertTriangle />
      <AlertTitle>Can&apos;t save yet</AlertTitle>
      <AlertDescription>
        <ul className="list-disc space-y-1 pl-4">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

function Field({
  label,
  children,
  className,
  optional,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  optional?: boolean;
}) {
  const generatedId = useId();
  const childId =
    isValidElement<{ id?: string }>(children) && children.props.id
      ? children.props.id
      : generatedId;
  const labeledChild = isValidElement<{ id?: string }>(children)
    ? cloneElement(children, { id: childId })
    : children;

  return (
    <div className={className ? `space-y-2 ${className}` : "space-y-2"}>
      <Label htmlFor={childId} className="flex items-center gap-1.5">
        {label}
        {optional ? (
          <span className="text-xs font-normal text-muted-foreground">
            Optional
          </span>
        ) : null}
      </Label>
      {labeledChild}
    </div>
  );
}

export function CampaignPageSkeleton({ width }: { width?: "narrow" } = {}) {
  if (width === "narrow") {
    return (
      <PageContainer width="narrow">
        <div className="space-y-5" aria-busy aria-label="Loading campaign">
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-8 w-72" />
          </div>

          <Card size="sm">
            <CardContent density="compact" className="space-y-6">
              <section className="space-y-4">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
                  <Skeleton className="h-10 w-full rounded-md" />
                  <Skeleton className="h-10 w-full rounded-md" />
                  <Skeleton className="h-16 w-full rounded-md sm:col-span-2" />
                </div>
              </section>

              <Separator />

              <section className="space-y-4">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <ol className="space-y-0">
                  {["planning", "submission", "approval", "lock"].map(
                    (step, i) => (
                      <li
                        key={step}
                        className="grid grid-cols-[1.25rem_1fr] gap-x-3"
                      >
                        <div className="flex flex-col items-center">
                          <Skeleton className="mt-1.5 size-3 rounded-full" />
                          {i < 3 && <span className="w-px flex-1 bg-border" />}
                        </div>
                        <div
                          className={cn("min-w-0", i === 3 ? "pb-0" : "pb-5")}
                        >
                          <div className="flex items-baseline justify-between">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-3 w-12" />
                          </div>
                          <Skeleton className="mt-1 h-3 w-52" />
                          <Skeleton className="mt-2 h-10 w-full rounded-md sm:max-w-[13rem]" />
                        </div>
                      </li>
                    )
                  )}
                </ol>
              </section>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <Skeleton className="h-4 w-28" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div
        className="flex flex-col gap-5"
        aria-busy
        aria-label="Loading campaign"
      >
        {/* Hero */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-28 rounded-full" />
          </div>
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-36" />
        </div>

        {/* Runway spine */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-2.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="hidden items-start gap-4 px-5 py-5 md:flex">
            {[0, 1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="flex flex-1 flex-col items-center gap-2"
              >
                <Skeleton className="size-11 rounded-xl" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 p-3 md:hidden">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="flex items-center gap-3 px-2 py-2">
                <Skeleton className="size-11 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stage */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-xl" />
              <Skeleton className="h-6 w-32" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-4 px-5 py-6 sm:px-6">
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md sm:col-span-2" />
            </div>
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
          <div className="flex items-center justify-between border-t border-border px-5 py-4 sm:px-6">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function emptyObjectiveForm(): ObjectiveForm {
  return {
    title: "",
    description: "",
    responsibleFunctionLabel: "",
  };
}

function fromCampaign(campaign: PerformanceCycleDetailDto): DraftForm {
  return {
    name: campaign.name,
    purpose: campaign.purpose ?? campaign.description ?? "",
    referenceYear:
      campaign.referenceYear ?? new Date(campaign.periodStart).getUTCFullYear(),
    planningOpeningDate: toDateInput(
      campaign.planningOpeningDate ?? campaign.periodStart
    ),
    employeeSubmissionDeadline: toDateInput(
      campaign.employeeSubmissionDeadline ??
        campaign.objectiveSettingDeadline ??
        campaign.periodStart
    ),
    managerApprovalDeadline: toDateInput(
      campaign.managerApprovalDeadline ??
        campaign.objectiveSettingDeadline ??
        campaign.periodStart
    ),
    expectedPlanningLockDate: toDateInput(
      campaign.expectedPlanningLockDate ?? campaign.periodEnd
    ),
  };
}

function fromObjective(
  objective: CampaignStrategicObjectiveDto
): ObjectiveForm {
  return {
    title: objective.title,
    description: objective.description ?? "",
    responsibleFunctionLabel: objective.responsibleFunctionLabel ?? "",
  };
}

function toDraftRequest(
  form: DraftForm
): CreatePerformanceCycleRequest | UpdatePerformanceCycleRequest {
  return {
    name: form.name.trim(),
    purpose: nullIfBlank(form.purpose),
    referenceYear: form.referenceYear,
    planningOpeningDate: toIsoDate(form.planningOpeningDate),
    employeeSubmissionDeadline: toIsoDate(form.employeeSubmissionDeadline),
    managerApprovalDeadline: toIsoDate(form.managerApprovalDeadline),
    expectedPlanningLockDate: toIsoDate(form.expectedPlanningLockDate),
  };
}

function toObjectiveRequest(
  form: ObjectiveForm
): UpsertCampaignStrategicObjectiveRequest {
  return {
    title: form.title.trim(),
    description: nullIfBlank(form.description),
    responsibleFunctionLabel: nullIfBlank(form.responsibleFunctionLabel),
  };
}

function validateDraftForm(form: DraftForm): string[] {
  const errors: string[] = [];
  if (!form.name.trim()) {
    errors.push("Campaign name is required.");
  }
  if (!form.referenceYear) {
    errors.push("Reference year is required.");
  }
  const dates = [
    form.planningOpeningDate,
    form.employeeSubmissionDeadline,
    form.managerApprovalDeadline,
    form.expectedPlanningLockDate,
  ];
  if (dates.some((date) => !date)) {
    errors.push("All planning schedule dates are required.");
  }
  if (dates.every(Boolean)) {
    if (form.employeeSubmissionDeadline < form.planningOpeningDate) {
      errors.push("Employee submission cannot be before planning opening.");
    }
    if (form.managerApprovalDeadline < form.employeeSubmissionDeadline) {
      errors.push("Manager approval cannot be before employee submission.");
    }
    if (form.expectedPlanningLockDate < form.managerApprovalDeadline) {
      errors.push("Planning lock cannot be before manager approval.");
    }
  }
  return errors;
}

function serializeDraftForm(form: DraftForm): string {
  return JSON.stringify(form);
}

function errorToMessages(error: Error): string[] {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return [
        "This campaign changed. Your edits are still here; review the latest values before saving again.",
      ];
    }
    if (error.status === 403) {
      return ["You do not have permission for this campaign action."];
    }
    return error.errors.length > 0 ? error.errors : [error.message];
  }

  if ("status" in error && (error as { status?: number }).status === 409) {
    return [
      "This campaign changed. Your edits are still here; review the latest values before saving again.",
    ];
  }
  if ("status" in error && (error as { status?: number }).status === 403) {
    return ["You do not have permission for this campaign action."];
  }

  return [error.message];
}

function dayGap(from: string, to: string): number {
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return 0;
  }
  return Math.round((end - start) / 86_400_000);
}

function toDateInput(value: string): string {
  return value.slice(0, 10);
}

function toIsoDate(value: string): string {
  return `${value}T00:00:00.000Z`;
}

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value)
  );
}

function parseWeights(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => `${item}%`);
    }
  } catch {
    // Existing configs may use comma-separated values.
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item.endsWith("%") ? item : `${item}%`));
}

function parseMeasurementMethods(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
