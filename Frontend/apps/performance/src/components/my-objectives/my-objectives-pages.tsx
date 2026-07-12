"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CalendarClock, CheckCircle2, ChevronRight, Pencil, Plus, Send, Trash2 } from "lucide-react";
import {
  ApiError,
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
} from "@repo/api";
import type {
  EmployeeObjectiveDto,
  EmployeeObjectivePlanWorkspaceDto,
  MyObjectivePlanCampaignDto,
  SaveEmployeeObjectiveRequest,
  SubmitObjectivePlanResponseDto,
} from "@repo/api";
import { useApiMutation, useApiQuery } from "@repo/api/query";
import { canAccessMyObjectives, useAuth } from "@repo/auth";
import {
  PageContainer,
  PageEmpty,
  PageError,
  PageHeader,
  PagePermissionNotice,
  StatusBadge,
} from "@repo/ds/shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/controls/confirm-dialog";
import { COVERED_COLOR } from "@/components/cascade-coverage/cascade-visuals";
import { formatDate, measurementMethodLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { myObjectiveTerms } from "./my-objectives-terms";
import { ObjectiveEditorDialog, type ObjectiveEditorState } from "./objective-editor-dialog";

// ── Employee door: my objective-plan campaigns ───────────────────────────────

export function MyObjectiveCampaignsPage() {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const canManage = canAccessMyObjectives(user);

  const { data, error, isLoading, refetch } = useApiQuery<MyObjectivePlanCampaignDto[]>(
    performanceQueryKeys.myObjectivePlanCampaigns(),
    (signal) =>
      apiClient.get<MyObjectivePlanCampaignDto[]>(
        performancePaths.myObjectivePlanCampaigns(),
        { signal },
      ),
    { enabled: canManage },
  );

  if (authLoading || (isLoading && canManage)) return <MyObjectiveListSkeleton />;

  if (!canManage) {
    return (
      <PageContainer>
        <PageHeader title={myObjectiveTerms.listTitle} description={myObjectiveTerms.listDescription} />
        <PagePermissionNotice title={myObjectiveTerms.accessTitle} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={myObjectiveTerms.listTitle} description={myObjectiveTerms.listDescription} />
      {error ? (
        <PageError title="Could not load objective plans" description="Try again." onRetry={refetch} />
      ) : data?.length ? (
        <div className="space-y-3">
          {data.map((campaign, index) =>
            index === 0 ? (
              <CampaignDoorHero key={campaign.id} campaign={campaign} />
            ) : (
              <CampaignDoorRow key={campaign.id} campaign={campaign} />
            ),
          )}
        </div>
      ) : (
        <PageEmpty
          title={myObjectiveTerms.emptyListTitle}
          description={myObjectiveTerms.emptyListDescription}
        />
      )}
    </PageContainer>
  );
}

function CampaignDoorHero({ campaign }: { campaign: MyObjectivePlanCampaignDto }) {
  const submitted = campaign.planStatus === "Submitted";
  return (
    <Link
      href={`/my-objectives/${campaign.slug}`}
      className="group block rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <StatusBadge tone={submitted ? "success" : "info"} dot>
            {submitted ? myObjectiveTerms.submitted : myObjectiveTerms.draft}
          </StatusBadge>
          <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-foreground">
            {campaign.name}
          </h2>
          {campaign.employeeSubmissionDeadline ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Submit by {formatDate(campaign.employeeSubmissionDeadline)}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-8 lg:shrink-0">
          <Metric value={`${campaign.totalWeight}%`} label="planned" />
          <Metric
            value={campaign.objectiveCount.toString()}
            label="objectives"
            muted={campaign.objectiveCount === 0}
          />
          <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

function CampaignDoorRow({ campaign }: { campaign: MyObjectivePlanCampaignDto }) {
  return (
    <Link
      href={`/my-objectives/${campaign.slug}`}
      className="group flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-semibold text-foreground">{campaign.name}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
          {campaign.objectiveCount} objectives · {campaign.totalWeight}% planned
        </p>
      </div>
      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

// ── Employee workspace: the objective plan ───────────────────────────────────

export function MyObjectiveWorkspacePage() {
  const params = useParams<{ slug?: string }>();
  const slug = params.slug ?? "";
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const canManage = canAccessMyObjectives(user);

  const [editor, setEditor] = useState<ObjectiveEditorState | null>(null);
  const [editorErrors, setEditorErrors] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<EmployeeObjectiveDto | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitReasons, setSubmitReasons] = useState<string[]>([]);

  const { data: workspace, error, isLoading, refetch } =
    useApiQuery<EmployeeObjectivePlanWorkspaceDto>(
      performanceQueryKeys.employeeObjectiveWorkspace(slug),
      (signal) =>
        apiClient.get<EmployeeObjectivePlanWorkspaceDto>(
          performancePaths.employeeObjectiveWorkspace(slug),
          { signal },
        ),
      { enabled: canManage && !!slug },
    );

  const cycleId = workspace?.cycleId ?? "";
  const planVersion = workspace?.plan?.version ?? 0;

  const save = useApiMutation<unknown, { objectiveId?: string; request: SaveEmployeeObjectiveRequest }>(
    ({ objectiveId, request }) =>
      objectiveId
        ? apiClient.put(performancePaths.employeeObjective(cycleId, objectiveId), request, {
            headers: { "If-Match": `"${planVersion}"` },
          })
        : apiClient.post(performancePaths.employeeObjectives(cycleId), request),
    {
      onSuccess: async () => {
        toast.success(myObjectiveTerms.saved);
        setEditor(null);
        setEditorErrors([]);
        await refetch();
      },
      onError: async (mutationError) => {
        setEditorErrors(errorMessages(mutationError));
        await refetch();
      },
    },
  );

  const remove = useApiMutation<void, EmployeeObjectiveDto>(
    (objective) =>
      apiClient.delete<void>(performancePaths.employeeObjective(cycleId, objective.id), {
        headers: { "If-Match": `"${planVersion}"` },
      }),
    {
      onSuccess: async () => {
        toast.success(myObjectiveTerms.deleted);
        setDeleting(null);
        await refetch();
      },
      onError: async (mutationError) => {
        toast.error(errorMessages(mutationError)[0]);
        setDeleting(null);
        await refetch();
      },
    },
  );

  const submit = useApiMutation<SubmitObjectivePlanResponseDto, void>(
    () =>
      apiClient.post<SubmitObjectivePlanResponseDto>(
        performancePaths.employeeObjectivePlanSubmit(cycleId),
        {},
        { headers: { "If-Match": `"${planVersion}"` } },
      ),
    {
      onSuccess: async (result) => {
        if (result.submitted) {
          toast.success(myObjectiveTerms.submittedToast);
          setSubmitReasons([]);
        } else {
          setSubmitReasons(result.blockingReasons.map((reason) => reason.message));
        }
        setConfirmSubmit(false);
        await refetch();
      },
      onError: async (mutationError) => {
        setSubmitReasons(errorMessages(mutationError));
        setConfirmSubmit(false);
        await refetch();
      },
    },
  );

  if (authLoading || (isLoading && canManage && !!slug)) return <MyObjectiveWorkspaceSkeleton />;

  if (!canManage) {
    return (
      <PageContainer>
        <PageHeader title={myObjectiveTerms.listTitle} />
        <PagePermissionNotice title={myObjectiveTerms.accessTitle} />
      </PageContainer>
    );
  }

  if (error || !workspace) {
    const status = error instanceof ApiError ? error.status : 0;
    return (
      <PageContainer>
        <PageHeader title={myObjectiveTerms.listTitle} />
        {status === 403 ? (
          <PagePermissionNotice title="Plan access denied" />
        ) : (
          <PageError
            title={status === 404 ? "Campaign not found" : "Could not load this plan"}
            description={status === 404 ? "It may have been removed, or the link is wrong." : "Try again."}
            onRetry={status === 404 ? undefined : refetch}
          />
        )}
      </PageContainer>
    );
  }

  const plan = workspace.plan;
  const objectives = plan?.objectives ?? [];
  const totalWeight = plan?.totalWeight ?? 0;
  const readOnly = workspace.state === "submitted";
  const atMax = objectives.length >= workspace.maxObjectiveCount;

  const checks = readinessChecks(objectives, totalWeight, workspace.maxObjectiveCount);
  const validForSubmit = workspace.state === "draft" && checks.every((check) => check.done);

  const openCreate = () => {
    setEditor({ mode: "create" });
    setEditorErrors([]);
  };
  const openEdit = (objective: EmployeeObjectiveDto) => {
    setEditor({ mode: "edit", objective });
    setEditorErrors([]);
  };
  const editingId = editor?.mode === "edit" ? editor.objective.id : null;
  const weightSpentElsewhere = objectives
    .filter((objective) => objective.id !== editingId)
    .reduce((sum, objective) => sum + (objective.weight ?? 0), 0);

  return (
    <PageContainer>
      <PageHeader
        title={workspace.name}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {workspace.referenceYear ? <span>{workspace.referenceYear}</span> : null}
            {workspace.employeeSubmissionDeadline ? (
              <span className="flex items-center gap-1.5">
                <CalendarClock className="size-3.5" />
                Submit by {formatDate(workspace.employeeSubmissionDeadline)}
              </span>
            ) : null}
          </span>
        }
      />

      {workspace.state === "entry-not-open" ? (
        <PageEmpty
          title={myObjectiveTerms.entryNotOpenTitle}
          description={myObjectiveTerms.entryNotOpenDescription(formatDate(workspace.planningOpeningDate))}
        />
      ) : (
        <div className="space-y-4">
          <AllocationSpine
            objectives={objectives}
            totalWeight={totalWeight}
            maxObjectiveCount={workspace.maxObjectiveCount}
            state={workspace.state}
            canEdit={!readOnly}
            onSegment={openEdit}
            onAdd={openCreate}
            atMax={atMax}
          />

          {readOnly ? (
            <div className="space-y-4">
              <SubmittedNotice approverName={plan?.approverName} submittedAt={plan?.submittedAt} />
              <ObjectiveList objectives={objectives} readOnly />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
              <section className="min-w-0 space-y-3">
                <div className="flex min-h-9 items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-foreground">
                    {myObjectiveTerms.objectivesHeading}
                  </h2>
                  {objectives.length > 0 ? (
                    <Button type="button" size="sm" variant="outline" disabled={atMax} onClick={openCreate}>
                      <Plus />
                      {myObjectiveTerms.addObjective}
                    </Button>
                  ) : null}
                </div>
                <ObjectiveList
                  objectives={objectives}
                  readOnly={false}
                  onEdit={openEdit}
                  onDelete={setDeleting}
                  onAddFirst={openCreate}
                />
              </section>

              <aside className="lg:sticky lg:top-4">
                <SubmitPanel
                  checks={checks}
                  valid={validForSubmit}
                  submitting={submit.isLoading}
                  blockingReasons={submitReasons}
                  onSubmit={() => setConfirmSubmit(true)}
                />
              </aside>
            </div>
          )}
        </div>
      )}

      <ObjectiveEditorDialog
        state={editor}
        workspace={workspace}
        weightSpentElsewhere={weightSpentElsewhere}
        isSaving={save.isLoading}
        errors={editorErrors}
        onSubmit={(request) =>
          save.mutate({ objectiveId: editingId ?? undefined, request })
        }
        onClose={() => {
          setEditor(null);
          setEditorErrors([]);
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (!open ? setDeleting(null) : undefined)}
        title={myObjectiveTerms.deleteTitle}
        description={myObjectiveTerms.deleteDescription}
        confirmLabel={myObjectiveTerms.deleteConfirm}
        cancelLabel={myObjectiveTerms.deleteCancel}
        destructive
        onConfirm={() => (deleting ? remove.mutate(deleting) : undefined)}
      />

      <ConfirmDialog
        open={confirmSubmit}
        onOpenChange={setConfirmSubmit}
        title={myObjectiveTerms.submitConfirmTitle}
        description={myObjectiveTerms.submitConfirmDescription}
        confirmLabel={myObjectiveTerms.submitConfirm}
        cancelLabel={myObjectiveTerms.submitCancel}
        onConfirm={() => submit.mutate()}
      />
    </PageContainer>
  );
}

// ── The allocation spine: the plan's 100% budget, pictured ───────────────────

/**
 * The signature of the plan: one continuous bar of the 100% weight budget. Each objective is a
 * segment sized to its weight — solid when complete, hollow-amber when it still needs detail —
 * and the unallocated remainder is a live, inviting gap. Segments open the objective; the gap adds one.
 */
function AllocationSpine({
  objectives,
  totalWeight,
  maxObjectiveCount,
  state,
  canEdit,
  onSegment,
  onAdd,
  atMax,
}: {
  objectives: EmployeeObjectiveDto[];
  totalWeight: number;
  maxObjectiveCount: number;
  state: EmployeeObjectivePlanWorkspaceDto["state"];
  canEdit: boolean;
  onSegment: (objective: EmployeeObjectiveDto) => void;
  onAdd: () => void;
  atMax: boolean;
}) {
  const over = Math.max(0, totalWeight - 100);
  const remaining = Math.max(0, 100 - totalWeight);
  const denominator = Math.max(100, totalWeight);
  const balanced = totalWeight === 100;
  const allComplete = objectives.length > 0 && objectives.every(objectiveComplete);

  const tone: "success" | "warning" | "info" =
    state === "submitted" ? "success" : state === "entry-not-open" ? "info" : balanced && allComplete ? "success" : "warning";
  const tag =
    state === "submitted"
      ? myObjectiveTerms.awaitingReview
      : state === "entry-not-open"
        ? myObjectiveTerms.entryClosed
        : balanced
          ? myObjectiveTerms.balanced
          : myObjectiveTerms.draft;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={tone} dot>
              {tag}
            </StatusBadge>
            <span className="text-sm text-muted-foreground tabular-nums">
              {myObjectiveTerms.count(objectives.length, maxObjectiveCount)}
            </span>
          </div>
          <div className="mt-3 flex items-end gap-3">
            <p
              className={cn(
                "font-heading text-5xl font-semibold leading-none tracking-tight tabular-nums",
                over > 0 ? "text-destructive" : "text-foreground",
              )}
            >
              {totalWeight}%
            </p>
            <p
              className={cn(
                "pb-1 text-sm font-medium tabular-nums",
                over > 0 ? "text-destructive" : balanced ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {over > 0
                ? myObjectiveTerms.over(over)
                : balanced
                  ? myObjectiveTerms.balanced
                  : myObjectiveTerms.toAllocate(remaining)}
            </p>
          </div>
        </div>
      </div>

      <div
        className="mt-4 flex h-12 w-full gap-0.5 rounded-xl"
        role="img"
        aria-label={`${totalWeight}% of 100% allocated across ${objectives.length} objectives`}
      >
        {objectives.map((objective) => {
          const width = ((objective.weight ?? 0) / denominator) * 100;
          if (width <= 0) return null;
          const missing = objectiveMissingFields(objective);
          const complete = missing.length === 0;
          const label = `${objective.title} - ${objective.weight ?? 0}%${
            complete ? "" : `, missing details: ${missing.join(", ")}`
          }`;
          return (
            <button
              key={objective.id}
              type="button"
              disabled={!canEdit}
              title={label}
              aria-label={label}
              onClick={() => onSegment(objective)}
              style={{ width: `${width}%` }}
              className={cn(
                "flex min-w-1.5 items-center justify-center overflow-hidden rounded-md bg-muted px-1 transition-[filter,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                canEdit && "hover:brightness-105",
                complete
                  ? "border border-emerald-500/45 bg-[repeating-linear-gradient(45deg,color-mix(in_oklab,var(--color-emerald-500)_78%,transparent)_0_7px,color-mix(in_oklab,var(--color-emerald-700)_70%,transparent)_7px_14px)] dark:border-emerald-400/45 dark:bg-[repeating-linear-gradient(45deg,color-mix(in_oklab,var(--color-emerald-400)_62%,transparent)_0_7px,color-mix(in_oklab,var(--color-emerald-700)_48%,transparent)_7px_14px)]"
                  : "border border-dashed border-amber-500/60 bg-[repeating-linear-gradient(45deg,color-mix(in_oklab,var(--color-amber-500)_22%,transparent)_0_6px,transparent_6px_12px)] dark:border-primary/55 dark:bg-[repeating-linear-gradient(45deg,color-mix(in_oklab,var(--color-primary)_24%,transparent)_0_6px,transparent_6px_12px)]",
              )}
            >
              <span
                className={cn(
                  "truncate text-[11px] font-semibold leading-none tabular-nums",
                  complete
                    ? "text-white drop-shadow-sm"
                    : "text-amber-900 dark:text-primary",
                )}
              >
                {objective.weight ?? 0}%
              </span>
            </button>
          );
        })}

        {remaining > 0 ? (
          canEdit && !atMax ? (
            <button
              type="button"
              onClick={onAdd}
              style={{ width: `${remaining}%` }}
              aria-label={myObjectiveTerms.toAllocate(remaining)}
              className="group flex min-w-16 items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-primary/40 bg-primary/[0.04] text-xs font-semibold text-primary transition-colors hover:border-primary/60 hover:bg-primary/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="size-3.5" />
              <span className="tabular-nums">{remaining}%</span>
            </button>
          ) : (
            <div
              style={{ width: `${remaining}%` }}
              className="min-w-3 rounded-md border-2 border-dashed border-border bg-muted/30"
            />
          )
        ) : null}
      </div>
    </section>
  );
}

// ── Objective list ───────────────────────────────────────────────────────────

function ObjectiveList({
  objectives,
  readOnly,
  onEdit,
  onDelete,
  onAddFirst,
}: {
  objectives: EmployeeObjectiveDto[];
  readOnly: boolean;
  onEdit?: (objective: EmployeeObjectiveDto) => void;
  onDelete?: (objective: EmployeeObjectiveDto) => void;
  onAddFirst?: () => void;
}) {
  if (objectives.length === 0) {
    return (
      <button
        type="button"
        onClick={onAddFirst}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/[0.04] px-6 py-12 text-center transition-colors hover:border-primary/60 hover:bg-primary/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Plus className="size-5" />
        </span>
        <span className="font-heading text-lg font-semibold text-foreground">
          {myObjectiveTerms.addFirst}
        </span>
        <span className="max-w-sm text-sm text-muted-foreground">
          Allocate 100% across a few measurable outcomes for the year.
        </span>
      </button>
    );
  }

  return (
    <ul
      className="grid gap-3"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 20rem), 1fr))" }}
    >
      {objectives.map((objective) => (
        <ObjectiveRow
          key={objective.id}
          objective={objective}
          readOnly={readOnly}
          onEdit={() => onEdit?.(objective)}
          onDelete={() => onDelete?.(objective)}
        />
      ))}
    </ul>
  );
}

// ── Objective card ───────────────────────────────────────────────────────────

function ObjectiveRow({
  objective,
  readOnly,
  onEdit,
  onDelete,
}: {
  objective: EmployeeObjectiveDto;
  readOnly: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const complete = objectiveComplete(objective);
  const missing = objectiveMissingFields(objective);
  const measurement = describeMeasurement(objective);
  return (
    <li className="relative flex h-full min-h-36 items-stretch gap-3 rounded-xl border border-border bg-card p-4">
      <span
        aria-hidden
        style={complete ? { background: COVERED_COLOR } : undefined}
        className={cn("w-1 shrink-0 rounded-full", !complete && "bg-amber-500/70")}
      />
      <div className={cn("min-w-0 flex-1", !readOnly && "pr-14")}>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <p className="font-heading text-2xl font-semibold leading-none tabular-nums text-foreground">
            {objective.weight ?? 0}
            <span className="text-base text-muted-foreground">%</span>
          </p>
          <h3 className="min-w-0 text-wrap font-semibold text-foreground">{objective.title}</h3>
          <StatusBadge tone={complete ? "success" : "warning"} dot>
            {complete ? myObjectiveTerms.complete : myObjectiveTerms.needsDetail}
          </StatusBadge>
        </div>
        {!complete ? (
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-amber-700 dark:text-primary">
            <span className="font-medium">{myObjectiveTerms.missingPrefix}</span>
            <span>{missing.join(", ")}</span>
          </p>
        ) : null}
        <ObjectiveMetadata label={myObjectiveTerms.supports}>
          {objective.alignmentTitle ?? myObjectiveTerms.notSet}
        </ObjectiveMetadata>
        <ObjectiveMetadata label={myObjectiveTerms.measure}>
          {measurement}
        </ObjectiveMetadata>
        {objective.deadline ? (
          <ObjectiveMetadata label={myObjectiveTerms.due}>
            {formatDate(objective.deadline)}
          </ObjectiveMetadata>
        ) : null}
      </div>
      {!readOnly ? (
        <div className="absolute right-3 top-3 flex shrink-0 items-start gap-0.5">
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Edit ${objective.title}`} onClick={onEdit}>
            <Pencil />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${objective.title}`}
            className="text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        </div>
      ) : null}
    </li>
  );
}

// ── Submit panel — quiet until it can commit ─────────────────────────────────

function SubmitPanel({
  checks,
  valid,
  submitting,
  blockingReasons,
  onSubmit,
}: {
  checks: ReadinessCheck[];
  valid: boolean;
  submitting: boolean;
  blockingReasons: string[];
  onSubmit: () => void;
}) {
  const remaining = checks.filter((check) => !check.done);
  return (
    <div className="space-y-3">
      <div className="flex min-h-9 items-center">
        <h2 className="text-base font-semibold text-foreground">{myObjectiveTerms.blockingHeading}</h2>
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
        {valid ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="font-medium text-foreground">{myObjectiveTerms.readyToSubmit}</span>
            </div>
            <div className="space-y-1 pl-6">
              <ObjectiveMetadata label={myObjectiveTerms.planWeight}>
                {myObjectiveTerms.balanced}
              </ObjectiveMetadata>
              <ObjectiveMetadata label={myObjectiveTerms.nextStep}>
                {myObjectiveTerms.managerReview}
              </ObjectiveMetadata>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {remaining.map((check) => (
              <li key={check.label} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                <span>{check.label}</span>
              </li>
            ))}
          </ul>
        )}

        {blockingReasons.length > 0 ? (
          <ul className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">
            {blockingReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}

        <Button type="button" className="w-full" disabled={!valid || submitting} onClick={onSubmit}>
          <Send />
          {myObjectiveTerms.submit}
        </Button>
      </div>
    </div>
  );
}

function SubmittedNotice({
  approverName,
  submittedAt,
}: {
  approverName?: string | null;
  submittedAt?: string | null;
}) {
  const submittedDate = submittedAt ? formatDate(submittedAt) : myObjectiveTerms.notSet;
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-heading text-lg font-semibold text-foreground">
            {myObjectiveTerms.awaitingReview}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{myObjectiveTerms.reviewNote}</p>
        </div>
        <dl className="grid gap-x-5 gap-y-1 text-sm sm:grid-cols-2 md:shrink-0">
          <KeyValue label={myObjectiveTerms.submittedLabel}>{submittedDate}</KeyValue>
          <KeyValue label={myObjectiveTerms.managerLabel}>
            {approverName ?? myObjectiveTerms.notSet}
          </KeyValue>
        </dl>
      </div>
    </div>
  );
}

function ObjectiveMetadata({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <p className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 font-medium text-foreground/85">{children}</span>
    </p>
  );
}

function KeyValue({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{children}</dd>
    </div>
  );
}

function Metric({ value, label, muted = false }: { value: string; label: string; muted?: boolean }) {
  return (
    <div>
      <p
        className={cn(
          "font-heading text-3xl font-semibold leading-none tabular-nums tracking-tight",
          muted ? "text-muted-foreground/60" : "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ── Skeletons ────────────────────────────────────────────────────────────────

function MyObjectiveListSkeleton() {
  return (
    <PageContainer>
      <div className="space-y-5" aria-busy aria-label="Loading my objectives">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    </PageContainer>
  );
}

function MyObjectiveWorkspaceSkeleton() {
  return (
    <PageContainer>
      <div className="space-y-5" aria-busy aria-label="Loading objective plan">
        <Skeleton className="h-8 w-72" />
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <Skeleton className="h-12 w-40" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      </div>
    </PageContainer>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type ReadinessCheck = { label: string; done: boolean };

function readinessChecks(
  objectives: EmployeeObjectiveDto[],
  totalWeight: number,
  maxObjectiveCount: number,
): ReadinessCheck[] {
  return [
    { label: "Add at least one objective", done: objectives.length > 0 },
    { label: `Keep to ${maxObjectiveCount} objectives`, done: objectives.length <= maxObjectiveCount },
    { label: "Balance weights to 100%", done: totalWeight === 100 },
    {
      label: "Fill in every objective's missing details",
      done: objectives.length > 0 && objectives.every(objectiveComplete),
    },
  ];
}

function objectiveComplete(objective: EmployeeObjectiveDto): boolean {
  if (
    !objective.title ||
    !objective.alignmentTargetId ||
    !objective.weight ||
    !objective.deadline ||
    !objective.measurementMethod
  ) {
    return false;
  }
  if (objective.measurementMethod === "Quantitative") {
    return !!objective.measurementIndicator && !!objective.targetValue;
  }
  if (objective.measurementMethod === "Qualitative") {
    return !!objective.successCriteria;
  }
  return false;
}

function objectiveMissingFields(objective: EmployeeObjectiveDto): string[] {
  const missing: string[] = [];
  if (!objective.title) missing.push("objective");
  if (!objective.alignmentTargetId) missing.push("supporting goal");
  if (!objective.weight) missing.push("weight");
  if (!objective.deadline) missing.push("target date");
  if (!objective.measurementMethod) {
    missing.push("measurement");
    return missing;
  }
  if (objective.measurementMethod === "Quantitative") {
    if (!objective.measurementIndicator) missing.push("indicator");
    if (!objective.targetValue) missing.push("target");
  }
  if (objective.measurementMethod === "Qualitative" && !objective.successCriteria) {
    missing.push("success criteria");
  }
  return missing;
}

function describeMeasurement(objective: EmployeeObjectiveDto): string {
  if (!objective.measurementMethod) return "No measurement yet";
  if (objective.measurementMethod === "Quantitative") {
    const target = [objective.targetValue, objective.targetUnit].filter(Boolean).join(" ");
    const indicator = objective.measurementIndicator;
    if (indicator && target) return `${indicator}: ${target}`;
    if (indicator) return indicator;
    return measurementMethodLabel(objective.measurementMethod);
  }
  if (objective.measurementMethod === "Qualitative") {
    return objective.successCriteria || measurementMethodLabel(objective.measurementMethod);
  }
  return measurementMethodLabel(objective.measurementMethod);
}

function errorMessages(error: Error): string[] {
  if (error instanceof ApiError) {
    if (error.status === 409 || error.status === 412 || error.status === 428) {
      return [myObjectiveTerms.conflict];
    }
    if (error.status === 403) {
      return [error.message || "You do not have permission for this action."];
    }
    return error.errors.length > 0 ? error.errors : [error.message];
  }
  return [error.message];
}
