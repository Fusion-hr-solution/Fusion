"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cloneElement, isValidElement, useEffect, useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  CircleCheck,
  CircleDashed,
  Lock,
  Pencil,
  Plus,
  Target,
  Trash2,
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
  PagedResponse,
  ToggleCampaignStrategicObjectiveRequest,
  UpdatePerformanceCycleRequest,
  UpsertCampaignStrategicObjectiveRequest,
} from "@repo/api";
import { useApiMutation, useApiQuery, useApiQueryClient } from "@repo/api/query";
import {
  canManagePerformanceCampaigns,
  canOperatePerformanceCycles,
  canViewPerformanceCampaigns,
  useAuth,
} from "@repo/auth";
import {
  PageContainer,
  PageEmpty,
  PageError,
  PageHeader,
  PageLoading,
  PagePermissionNotice,
  StatusBadge,
} from "@repo/ds/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/controls/confirm-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CampaignCreateDialog } from "./campaign-create-dialog";
import {
  CampaignLaunchedBaseline,
  CampaignPopulationSection,
  CampaignReadinessSection,
} from "./campaign-launch-sections";
import {
  campaignDiscard,
  campaignReadiness,
  campaignScheduleSteps,
  campaignStatusLabel,
  campaignStatusTone,
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

const SCHEDULE_STEPS: { key: ScheduleKey; label: string; caption: string; short: string }[] =
  SCHEDULE_STEP_ORDER.map((key) => ({ key, ...campaignScheduleSteps[key] }));

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - 1 + index);

export function CampaignListPage() {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const canView = canViewPerformanceCampaigns(user);
  const canManage = canManagePerformanceCampaigns(user);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, error, isLoading, refetch } = useApiQuery<PagedResponse<PerformanceCycleSummaryDto>>(
    performanceQueryKeys.cycleList({ status: "Draft", page: 1, pageSize: 50 }),
    (signal) =>
      apiClient.get<PagedResponse<PerformanceCycleSummaryDto>>(performancePaths.cycles(), {
        signal,
        params: { status: "Draft", page: 1, pageSize: 50 },
      }),
    { enabled: canView },
  );

  if (authLoading) {
    return <CampaignPageSkeleton />;
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
        description="Create and set up your performance planning campaigns."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus /> {campaignTerms.newTitle}
            </Button>
          ) : null
        }
      />

      {isLoading ? <PageLoading rows={5} label="Loading campaigns" /> : null}
      {!isLoading && error ? (
        <PageError title="Could not load campaigns" description="Try again." onRetry={refetch} />
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
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="grid grid-cols-[1.5fr_0.6fr_0.7fr_0.8fr] gap-3 border-b border-border bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground">
              <span>Campaign</span>
              <span>Year</span>
              <span>Status</span>
              <span>Created</span>
            </div>
            {data.items.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.slug}`}
                className="grid grid-cols-[1.5fr_0.6fr_0.7fr_0.8fr] items-center gap-3 border-b border-border px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{campaign.name}</span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">{campaign.slug}</span>
                </span>
                <span className="tabular-nums">
                  {campaign.referenceYear ?? new Date(campaign.periodStart).getUTCFullYear()}
                </span>
                <span>
                  <StatusBadge tone={campaignStatusTone(campaign.status)}>
                    {campaignStatusLabel(campaign.status)}
                  </StatusBadge>
                </span>
                <span className="text-muted-foreground">{formatDate(campaign.createdAt)}</span>
              </Link>
            ))}
          </div>
        )
      ) : null}

      <CampaignCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </PageContainer>
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
  const [form, setForm] = useState<DraftForm | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [objectiveForm, setObjectiveForm] = useState<ObjectiveForm>(() => emptyObjectiveForm());
  const [editingObjectiveId, setEditingObjectiveId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const {
    data: campaign,
    error,
    isLoading,
    refetch,
  } = useApiQuery<PerformanceCycleDetailDto>(
    performanceQueryKeys.cycleBySlug(slug),
    (signal) => apiClient.get<PerformanceCycleDetailDto>(performancePaths.cycleBySlug(slug), { signal }),
    { enabled: canView && !!slug },
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

  const update = useApiMutation<PerformanceCycleDetailDto, UpdatePerformanceCycleRequest>(
    (request) =>
      apiClient.put<PerformanceCycleDetailDto>(performancePaths.cycle(campaignId), request, {
        headers: { "If-Match": `"${campaign?.version ?? 0}"` },
      }),
    {
      onSuccess: async () => {
        toast.success("Campaign saved");
        await refetch();
      },
      onError: (error) => setErrors(errorToMessages(error)),
    },
  );

  const addObjective = useApiMutation<
    CampaignStrategicObjectiveDto,
    UpsertCampaignStrategicObjectiveRequest
  >(
    (request) =>
      apiClient.post<CampaignStrategicObjectiveDto>(
        performancePaths.campaignStrategicObjectives(campaignId),
        request,
      ),
    {
      onSuccess: async () => {
        toast.success("Strategic objective added");
        setObjectiveForm(emptyObjectiveForm());
        setIsAdding(false);
        await refetch();
      },
      onError: (error) => setErrors(errorToMessages(error)),
    },
  );

  const updateObjective = useApiMutation<
    CampaignStrategicObjectiveDto,
    { objective: CampaignStrategicObjectiveDto; request: UpsertCampaignStrategicObjectiveRequest }
  >(
    ({ objective, request }) =>
      apiClient.put<CampaignStrategicObjectiveDto>(
        performancePaths.campaignStrategicObjective(campaignId, objective.id),
        request,
        { headers: { "If-Match": `"${objective.version}"` } },
      ),
    {
      onSuccess: async () => {
        toast.success("Strategic objective saved");
        setEditingObjectiveId(null);
        setObjectiveForm(emptyObjectiveForm());
        await refetch();
      },
      onError: (error) => setErrors(errorToMessages(error)),
    },
  );

  const toggleObjective = useApiMutation<
    CampaignStrategicObjectiveDto,
    { objective: CampaignStrategicObjectiveDto; request: ToggleCampaignStrategicObjectiveRequest }
  >(
    ({ objective, request }) =>
      apiClient.put<CampaignStrategicObjectiveDto>(
        performancePaths.campaignStrategicObjectiveActiveState(campaignId, objective.id),
        request,
        { headers: { "If-Match": `"${objective.version}"` } },
      ),
    {
      onSuccess: async () => {
        await refetch();
      },
      onError: (error) => setErrors(errorToMessages(error)),
    },
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
        queryClient.invalidateQueries({ queryKey: [...performanceQueryKeys.cycles(), "list"] });
        toast.success(campaignDiscard.success);
        router.push("/campaigns");
      },
      onError: (error) => {
        setDiscardOpen(false);
        setErrors(errorToMessages(error));
      },
    },
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
          description={notFound ? "It may have been removed, or the link is wrong." : "Try again."}
          onRetry={notFound ? undefined : refetch}
        />
      </PageContainer>
    );
  }

  const isDraft = campaign.status === "Draft";
  const localErrors = validateDraftForm(form);
  const isDirty = serializeDraftForm(form) !== serializeDraftForm(fromCampaign(campaign));
  const canSave = canManage && isDraft && isDirty && localErrors.length === 0 && !update.isLoading;
  const readOnly = !canManage || !isDraft;
  const canDiscard = canManage && isDraft;
  const objectiveRequest = toObjectiveRequest(objectiveForm);

  return (
    <PageContainer>
      <PageHeader
        title={campaign.name}
        eyebrow={
          <div className="flex items-center gap-2">
            <StatusBadge tone={campaignStatusTone(campaign.status)}>
              {campaignStatusLabel(campaign.status)}
            </StatusBadge>
            <span className="font-mono text-xs text-muted-foreground">{campaign.slug}</span>
          </div>
        }
        description={campaign.ownerName ? `Owned by ${campaign.ownerName}` : undefined}
        actions={
          readOnly ? (
            <Badge variant="outline">{campaignTerms.readOnly}</Badge>
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
          ) : null
        }
      />

      {errors.length > 0 ? <div className="mb-5"><CampaignErrorList errors={errors} /></div> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-5">
          <IdentityScheduleCard form={form} onChange={setForm} disabled={readOnly || update.isLoading} />

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
            onSubmitEdit={(objective) => updateObjective.mutate({ objective, request: objectiveRequest })}
            onToggle={(objective, isActive) => toggleObjective.mutate({ objective, request: { isActive } })}
          />

          {!readOnly && isDirty ? (
            <WorkspaceActionBar
              sticky
              statusLabel="Unsaved changes"
              hint={localErrors.length > 0 ? localErrors[0] : undefined}
              primaryLabel={update.isLoading ? "Saving…" : campaignTerms.saveAction}
              primaryDisabled={!canSave}
              onPrimary={() => {
                setErrors([]);
                update.mutate(toDraftRequest(form));
              }}
              secondary={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={update.isLoading}
                  onClick={() => {
                    setForm(fromCampaign(campaign));
                    setErrors([]);
                  }}
                >
                  Discard changes
                </Button>
              }
            />
          ) : null}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          {isDraft ? <SetupProgress form={form} campaign={campaign} /> : null}
          <RulesSnapshotSection snapshot={campaign.planningRulesSnapshot} />
        </aside>
      </div>

      <div className="mt-5 space-y-5">
        {isDraft ? (
          <>
            <CampaignPopulationSection campaign={campaign} canManage={canManage} onSaved={refetch} />
            <CampaignReadinessSection
              campaign={campaign}
              canManage={canManage}
              canOperate={canOperate}
              onChanged={refetch}
            />
          </>
        ) : (
          <CampaignLaunchedBaseline campaign={campaign} />
        )}
      </div>

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

function IdentityScheduleCard({
  form,
  onChange,
  disabled,
}: {
  form: DraftForm;
  onChange: (form: DraftForm) => void;
  disabled: boolean;
}) {
  return (
    <Card size="sm">
      <CardContent density="compact" className="space-y-6">
        <IdentityFields form={form} onChange={onChange} disabled={disabled} />
        <Separator />
        <ScheduleTimeline form={form} onChange={onChange} disabled={disabled} />
      </CardContent>
    </Card>
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
    <section className="space-y-4">
      <SectionTitle>{campaignTerms.identity}</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <Field label="Campaign name">
          <Input
            value={form.name}
            disabled={disabled}
            placeholder="e.g. FY26 Annual Planning"
            onChange={(event) => onChange({ ...form, name: event.target.value })}
          />
        </Field>
        <Field label="Reference year">
          <NativeSelect
            className="w-full [color-scheme:light] dark:[color-scheme:dark]"
            value={String(form.referenceYear)}
            disabled={disabled}
            onChange={(event) => onChange({ ...form, referenceYear: Number(event.target.value) })}
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
            onChange={(event) => onChange({ ...form, purpose: event.target.value })}
          />
        </Field>
      </div>
    </section>
  );
}

function ScheduleTimeline({
  form,
  onChange,
  disabled,
}: {
  form: DraftForm;
  onChange: (form: DraftForm) => void;
  disabled: boolean;
}) {
  const values = SCHEDULE_STEPS.map((step) => form[step.key]);

  return (
    <section className="space-y-4">
      <SectionTitle hint="Milestones run in order — each date must fall on or after the one above.">
        {campaignTerms.schedule}
      </SectionTitle>
      <ol className="space-y-0">
        {SCHEDULE_STEPS.map((step, index) => {
          const value = values[index] ?? "";
          const previousStep = index > 0 ? SCHEDULE_STEPS[index - 1] : undefined;
          const previous = index > 0 ? (values[index - 1] ?? "") : "";
          const outOfOrder = !!value && !!previous && value < previous;
          const isLast = index === SCHEDULE_STEPS.length - 1;
          const gapDays = value && previous ? dayGap(previous, value) : null;

          return (
            <li key={step.key} className="grid grid-cols-[1.25rem_1fr] gap-x-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "mt-1.5 flex size-3 items-center justify-center rounded-full border-2",
                    outOfOrder
                      ? "border-destructive bg-destructive/15"
                      : value
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/40 bg-background",
                  )}
                />
                {!isLast ? (
                  <span className={cn("w-px flex-1", outOfOrder ? "bg-destructive/40" : "bg-border")} />
                ) : null}
              </div>
              <div className={cn("min-w-0", isLast ? "pb-0" : "pb-5")}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <Label htmlFor={`schedule-${step.key}`} className="text-sm font-medium">
                    {step.label}
                  </Label>
                  {gapDays !== null && !outOfOrder ? (
                    <span className="text-xs text-muted-foreground">
                      +{gapDays} {gapDays === 1 ? "day" : "days"}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{step.caption}</p>
                <Input
                  id={`schedule-${step.key}`}
                  type="date"
                  value={value}
                  disabled={disabled}
                  aria-invalid={outOfOrder}
                  className={cn(
                    "mt-2 w-full sm:max-w-[13rem] [color-scheme:light] dark:[color-scheme:dark]",
                    outOfOrder && "border-destructive",
                  )}
                  onChange={(event) => onChange({ ...form, [step.key]: event.target.value })}
                />
                {outOfOrder && previousStep ? (
                  <p className="mt-1.5 text-xs font-medium text-destructive">
                    Must be on or after {previousStep.short}.
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
  onToggle: (objective: CampaignStrategicObjectiveDto, isActive: boolean) => void;
}) {
  const activeCount = objectives.filter((objective) => objective.isActive).length;

  return (
    <Card size="sm">
      <CardHeader density="compact" className="flex items-center justify-between gap-2 border-b">
        <div className="space-y-0.5">
          <CardTitle>{campaignTerms.strategicObjectives}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {objectives.length === 0
              ? "The goals this campaign is built around."
              : `${activeCount} active of ${objectives.length}`}
          </p>
        </div>
        {!readOnly && !isAdding ? (
          <Button type="button" size="sm" variant="outline" onClick={onStartAdd}>
            <Plus /> {campaignTerms.addObjectiveAction}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent density="compact" className="space-y-3">
        {objectives.length === 0 && !isAdding ? (
          <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <Target className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No strategic objectives yet</p>
            <p className="text-xs text-muted-foreground">
              Add at least one active objective to complete setup.
            </p>
          </div>
        ) : null}

        {objectives.length > 0 ? (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {objectives.map((objective) => {
              const isEditing = editingObjectiveId === objective.id;
              return (
                <li key={objective.id} className={cn("p-3", !objective.isActive && !isEditing && "bg-muted/30")}>
                  {isEditing ? (
                    <div className="space-y-3">
                      <ObjectiveEditor form={objectiveForm} onChange={onObjectiveFormChange} disabled={isBusy} />
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="ghost" onClick={onCancelEdit} disabled={isBusy}>
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => onSubmitEdit(objective)}
                          disabled={!objectiveRequest.title || isBusy}
                        >
                          Save objective
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn("font-medium", !objective.isActive && "text-muted-foreground")}>
                            {objective.title}
                          </span>
                          {objective.responsibleFunctionLabel ? (
                            <Badge variant="outline">{objective.responsibleFunctionLabel}</Badge>
                          ) : null}
                        </div>
                        {objective.description ? (
                          <p className="text-sm text-muted-foreground">{objective.description}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="w-10 text-right">{objective.isActive ? "Active" : "Inactive"}</span>
                          <Switch
                            checked={objective.isActive}
                            disabled={readOnly || isToggling}
                            onCheckedChange={(isActive) => onToggle(objective, isActive)}
                            aria-label={`${objective.isActive ? "Deactivate" : "Activate"} ${objective.title}`}
                          />
                        </label>
                        {!readOnly ? (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => onStartEdit(objective)}
                            aria-label={`Edit ${objective.title}`}
                          >
                            <Pencil />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}

        {isAdding ? (
          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
            <ObjectiveEditor form={objectiveForm} onChange={onObjectiveFormChange} disabled={isBusy} autoFocus />
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={onCancelAdd} disabled={isBusy}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={onSubmitAdd} disabled={!objectiveRequest.title || isBusy}>
                <Plus /> {campaignTerms.addObjectiveAction}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
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
          onChange={(event) => onChange({ ...form, description: event.target.value })}
        />
      </Field>
      <Field label="Responsible function" optional className="sm:col-span-2">
        <Input
          value={form.responsibleFunctionLabel}
          disabled={disabled}
          placeholder="e.g. Consulting"
          onChange={(event) => onChange({ ...form, responsibleFunctionLabel: event.target.value })}
        />
      </Field>
    </div>
  );
}

type ReadinessItem = { label: string; done: boolean };

function SetupProgress({
  form,
  campaign,
}: {
  form: DraftForm;
  campaign: PerformanceCycleDetailDto;
}) {
  const scheduleDates = SCHEDULE_STEPS.map((step) => form[step.key]);
  const scheduleComplete = scheduleDates.every(Boolean);
  const scheduleOrdered =
    scheduleComplete &&
    scheduleDates.every((value, index) => index === 0 || (scheduleDates[index - 1] ?? "") <= value);
  const activeCount = campaign.strategicObjectives.filter((objective) => objective.isActive).length;

  const items: ReadinessItem[] = [
    { label: campaignReadiness.items.identity, done: !!form.name.trim() && !!form.referenceYear },
    { label: campaignReadiness.items.schedule, done: scheduleComplete && scheduleOrdered },
    { label: campaignReadiness.items.rules, done: !!campaign.planningRulesSnapshot },
    { label: campaignReadiness.items.objective, done: activeCount > 0 },
  ];

  const remaining = items.filter((item) => !item.done).length;
  const complete = remaining === 0;

  const badgeLabel = complete
    ? campaignReadiness.readyForPopulation
    : campaignReadiness.remaining(remaining);

  const footer = complete ? campaignReadiness.completeFooter : campaignReadiness.incompleteFooter;

  return (
    <Card size="sm">
      <CardHeader density="compact" className="border-b">
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{campaignReadiness.title}</span>
          <StatusBadge tone={complete ? "success" : "warning"}>{badgeLabel}</StatusBadge>
        </CardTitle>
      </CardHeader>
      <CardContent density="compact">
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item.label} className="flex items-start gap-2.5 text-sm">
              {item.done ? (
                <CircleCheck className="mt-px size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <CircleDashed className="mt-px size-4 shrink-0 text-muted-foreground" />
              )}
              <span className={cn(item.done ? "text-foreground" : "text-muted-foreground")}>{item.label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">{footer}</p>
      </CardContent>
    </Card>
  );
}

function RulesSnapshotSection({ snapshot }: { snapshot: CampaignPlanningRulesSnapshotDto | null }) {
  return (
    <Card size="sm">
      <CardHeader density="compact" className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Lock className="size-3.5 text-muted-foreground" />
          {campaignTerms.rules}
        </CardTitle>
      </CardHeader>
      <CardContent density="compact" className="space-y-4">
        {snapshot ? (
          <>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Maximum objectives</p>
              <p className="text-sm font-medium tabular-nums">{snapshot.maxObjectiveCount}</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Allowed weights</p>
              <ChipList values={parseWeights(snapshot.allowedWeightMenu)} />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Measurement methods</p>
              <ChipList values={parseMeasurementMethods(snapshot.enabledMeasurementMethods)} />
            </div>
            <p className="border-t border-border pt-3 text-xs text-muted-foreground">
              Copied from your objective planning settings on {formatDate(snapshot.capturedAt)}.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No rules snapshot.</p>
        )}
      </CardContent>
    </Card>
  );
}

function WorkspaceActionBar({
  primaryLabel,
  primaryDisabled,
  onPrimary,
  secondary,
  hint,
  statusLabel,
  sticky,
}: {
  primaryLabel: string;
  primaryDisabled: boolean;
  onPrimary: () => void;
  secondary: ReactNode;
  hint?: string;
  statusLabel?: string;
  sticky?: boolean;
}) {
  return (
    <div className={cn(sticky && "sticky bottom-4 z-10")}>
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3",
          sticky
            ? "bg-card/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80"
            : "bg-card",
        )}
      >
        <div className="flex min-w-0 items-center gap-2 text-sm">
          {statusLabel ? (
            <>
              <span className="size-1.5 shrink-0 rounded-full bg-primary" />
              <span className="font-medium text-foreground">{statusLabel}</span>
            </>
          ) : null}
          {hint ? (
            <span className="truncate text-muted-foreground">
              {statusLabel ? "— " : null}
              {hint}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {secondary}
          <Button type="button" size="sm" disabled={primaryDisabled} onClick={onPrimary}>
            {primaryLabel}
          </Button>
        </div>
      </div>
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

function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <h2 className="text-sm font-medium text-foreground">{children}</h2>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
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
        {optional ? <span className="text-xs font-normal text-muted-foreground">Optional</span> : null}
      </Label>
      {labeledChild}
    </div>
  );
}

function CampaignPageSkeleton() {
  return (
    <PageContainer>
      <div className="space-y-5" aria-busy aria-label="Loading campaign">
        <div className="space-y-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="space-y-5">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
          <div className="space-y-5">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
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
    referenceYear: campaign.referenceYear ?? new Date(campaign.periodStart).getUTCFullYear(),
    planningOpeningDate: toDateInput(campaign.planningOpeningDate ?? campaign.periodStart),
    employeeSubmissionDeadline: toDateInput(campaign.employeeSubmissionDeadline ?? campaign.objectiveSettingDeadline ?? campaign.periodStart),
    managerApprovalDeadline: toDateInput(campaign.managerApprovalDeadline ?? campaign.objectiveSettingDeadline ?? campaign.periodStart),
    expectedPlanningLockDate: toDateInput(campaign.expectedPlanningLockDate ?? campaign.periodEnd),
  };
}

function fromObjective(objective: CampaignStrategicObjectiveDto): ObjectiveForm {
  return {
    title: objective.title,
    description: objective.description ?? "",
    responsibleFunctionLabel: objective.responsibleFunctionLabel ?? "",
  };
}

function toDraftRequest(form: DraftForm): CreatePerformanceCycleRequest | UpdatePerformanceCycleRequest {
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

function toObjectiveRequest(form: ObjectiveForm): UpsertCampaignStrategicObjectiveRequest {
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
      return ["This campaign changed. Your edits are still here; review the latest values before saving again."];
    }
    if (error.status === 403) {
      return ["You do not have permission for this campaign action."];
    }
    return error.errors.length > 0 ? error.errors : [error.message];
  }

  if ("status" in error && (error as { status?: number }).status === 409) {
    return ["This campaign changed. Your edits are still here; review the latest values before saving again."];
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
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
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
