"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronRight,
  ClipboardCheck,
  MessageSquareText,
  SendHorizonal,
} from "lucide-react";
import {
  ApiError,
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
} from "@repo/api";
import type {
  EmployeeObjectiveDto,
  PlanApprovalCampaignDto,
  PlanApprovalReviewDto,
  PlanApprovalWorkspaceDto,
  RequestObjectivePlanChangesRequest,
} from "@repo/api";
import { useApiMutation, useApiQuery } from "@repo/api/query";
import { canAccessPlanApprovals, useAuth } from "@repo/auth";
import {
  PageContainer,
  PageEmpty,
  PageError,
  PageHeader,
  PagePermissionNotice,
  StatusBadge,
} from "@repo/ds/shell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, measurementMethodLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const reviewGroups = [
  { key: "waiting-for-review", title: "Waiting for review" },
  { key: "changes-requested", title: "Changes requested" },
  { key: "approved", title: "Approved" },
] as const;

export function PlanApprovalCampaignsPage() {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const canReview = canAccessPlanApprovals(user);

  const { data, error, isLoading, refetch } = useApiQuery<PlanApprovalCampaignDto[]>(
    performanceQueryKeys.myPlanApprovalCampaigns(),
    (signal) =>
      apiClient.get<PlanApprovalCampaignDto[]>(
        performancePaths.myPlanApprovalCampaigns(),
        { signal },
      ),
    { enabled: canReview },
  );

  if (authLoading || (isLoading && canReview)) return <PlanApprovalListSkeleton />;

  if (!canReview) {
    return (
      <PageContainer>
        <PageHeader title="Plan approvals" />
        <PagePermissionNotice title="Plan approval access required" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Plan approvals" />

      {error ? (
        <PageError title="Could not load approvals" description="Try again." onRetry={refetch} />
      ) : data?.length ? (
        <div className="space-y-3">
          {data.map((campaign, index) =>
            index === 0 ? (
              <PlanApprovalCampaignHero key={campaign.id} campaign={campaign} />
            ) : (
              <PlanApprovalCampaignRow key={campaign.id} campaign={campaign} />
            ),
          )}
        </div>
      ) : (
        <PageEmpty
          title="No plans assigned to you"
          description="No launched campaign assigns you employee objective plans to review."
        />
      )}
    </PageContainer>
  );
}

function PlanApprovalCampaignHero({ campaign }: { campaign: PlanApprovalCampaignDto }) {
  const active = campaign.waitingForReviewCount + campaign.dataIssueCount;
  return (
    <Link
      href={`/plan-approvals/${campaign.slug}`}
      className="group block rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <StatusBadge tone={active > 0 ? "warning" : "success"} dot>
            {active > 0 ? "Review needed" : "Clear"}
          </StatusBadge>
          <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-foreground">
            {campaign.name}
          </h2>
          {campaign.managerApprovalDeadline ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarClock className="size-3.5" />
              Review by {formatDate(campaign.managerApprovalDeadline)}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-7 lg:shrink-0">
          <Metric value={campaign.waitingForReviewCount} label="waiting" />
          <Metric value={campaign.changesRequestedCount} label="returned" />
          <Metric value={campaign.approvedCount} label="approved" />
          <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

function PlanApprovalCampaignRow({ campaign }: { campaign: PlanApprovalCampaignDto }) {
  return (
    <Link
      href={`/plan-approvals/${campaign.slug}`}
      className="group flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-semibold text-foreground">{campaign.name}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
          {campaign.waitingForReviewCount} waiting · {campaign.changesRequestedCount} returned · {campaign.approvedCount} approved
        </p>
      </div>
      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function PlanApprovalWorkspacePage() {
  const params = useParams<{ slug?: string }>();
  const slug = params.slug ?? "";
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const canReview = canAccessPlanApprovals(user);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [requestingChanges, setRequestingChanges] = useState<PlanApprovalReviewDto | null>(null);

  const { data: workspace, error, isLoading, refetch } =
    useApiQuery<PlanApprovalWorkspaceDto>(
      performanceQueryKeys.planApprovalWorkspace(slug),
      (signal) =>
        apiClient.get<PlanApprovalWorkspaceDto>(
          performancePaths.planApprovalWorkspace(slug),
          { signal },
        ),
      { enabled: canReview && !!slug },
    );

  const selected =
    workspace?.plans.find((plan) => plan.planId === selectedPlanId) ??
    workspace?.plans.find((plan) => plan.reviewState === "waiting-for-review" && !plan.isSelfApprovalDataIssue) ??
    workspace?.plans[0] ??
    null;
  const isLocked = !!workspace?.planningLockedAt;

  const approve = useApiMutation<PlanApprovalReviewDto, PlanApprovalReviewDto>(
    (plan) =>
      apiClient.post<PlanApprovalReviewDto>(
        performancePaths.planApprovalApprove(workspace?.cycleId ?? plan.cycleId, plan.planId),
        {},
        { headers: { "If-Match": `"${plan.version}"` } },
      ),
    {
      onSuccess: async () => {
        toast.success("Plan approved");
        await refetch();
      },
      onError: async (mutationError) => {
        toast.error(errorMessage(mutationError));
        await refetch();
      },
    },
  );

  const requestChanges = useApiMutation<
    PlanApprovalReviewDto,
    { plan: PlanApprovalReviewDto; request: RequestObjectivePlanChangesRequest }
  >(
    ({ plan, request }) =>
      apiClient.post<PlanApprovalReviewDto>(
        performancePaths.planApprovalRequestChanges(workspace?.cycleId ?? plan.cycleId, plan.planId),
        request,
        { headers: { "If-Match": `"${plan.version}"` } },
      ),
    {
      onSuccess: async () => {
        toast.success("Changes requested");
        setRequestingChanges(null);
        await refetch();
      },
      onError: async (mutationError) => {
        toast.error(errorMessage(mutationError));
        await refetch();
      },
    },
  );

  if (authLoading || (isLoading && canReview && !!slug)) return <PlanApprovalWorkspaceSkeleton />;

  if (!canReview) {
    return (
      <PageContainer>
        <PageHeader title="Plan approvals" />
        <PagePermissionNotice title="Plan approval access required" />
      </PageContainer>
    );
  }

  if (error || !workspace) {
    const status = error instanceof ApiError ? error.status : 0;
    return (
      <PageContainer>
        <PageHeader title="Plan approvals" />
        {status === 403 ? (
          <PagePermissionNotice title="Approval scope required" />
        ) : (
          <PageError
            title={status === 404 ? "Campaign not found" : "Could not load approvals"}
            description={status === 404 ? "It may have been removed, or the link is wrong." : "Try again."}
            onRetry={status === 404 ? undefined : refetch}
          />
        )}
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={workspace.name}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {workspace.referenceYear ? <span>{workspace.referenceYear}</span> : null}
            {workspace.managerApprovalDeadline ? (
              <span className="flex items-center gap-1.5">
                <CalendarClock className="size-3.5" />
                Review by {formatDate(workspace.managerApprovalDeadline)}
              </span>
            ) : null}
          </span>
        }
        actions={<ReviewMeter workspace={workspace} />}
      />

      {workspace.plans.length === 0 ? (
        <PageEmpty
          title="No submitted plans"
          description="No launched campaign assigns you plans that are ready for review."
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
          <ReviewQueue
            plans={workspace.plans}
            selectedPlanId={selected?.planId ?? null}
            onSelect={setSelectedPlanId}
          />
          {selected ? (
            <PlanReviewDetail
              plan={selected}
              currentUserName={user?.fullName ?? null}
              locked={isLocked}
              approving={approve.isLoading}
              requesting={requestChanges.isLoading}
              onApprove={() => approve.mutate(selected)}
              onRequestChanges={() => setRequestingChanges(selected)}
            />
          ) : null}
        </div>
      )}

      <RequestChangesDialog
        plan={requestingChanges}
        isSaving={requestChanges.isLoading}
        onClose={() => setRequestingChanges(null)}
        onSubmit={(request) =>
          requestingChanges
            ? requestChanges.mutate({ plan: requestingChanges, request })
            : undefined
        }
      />
    </PageContainer>
  );
}

function ReviewQueue({
  plans,
  selectedPlanId,
  onSelect,
}: {
  plans: PlanApprovalReviewDto[];
  selectedPlanId: string | null;
  onSelect: (planId: string) => void;
}) {
  return (
    <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
      {reviewGroups.map((group) => {
        const groupPlans = plans.filter((plan) => plan.reviewState === group.key);
        if (groupPlans.length === 0) return null;
        return (
          <section key={group.key} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">{group.title}</h2>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {groupPlans.length}
              </span>
            </div>
            <div className="space-y-2">
              {groupPlans.map((plan) => (
                <button
                  key={plan.planId}
                  type="button"
                  onClick={() => onSelect(plan.planId)}
                  className={cn(
                    "w-full rounded-xl border bg-card p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selectedPlanId === plan.planId
                      ? "border-primary/55 bg-primary/[0.06]"
                      : "border-border hover:border-primary/35 hover:bg-muted/30",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{plan.employeeName}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {plan.jobTitle ?? plan.orgUnitName ?? "Employee plan"}
                      </p>
                    </div>
                    <StatusPill plan={plan} />
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                    <span>{plan.objectiveCount} objectives</span>
                    <span>{plan.totalWeight}% weight</span>
                  </div>
                  {plan.isSelfApprovalDataIssue ? (
                    <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-amber-700 dark:text-primary">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      Data issue
                    </p>
                  ) : null}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </aside>
  );
}

function PlanReviewDetail({
  plan,
  currentUserName,
  locked,
  approving,
  requesting,
  onApprove,
  onRequestChanges,
}: {
  plan: PlanApprovalReviewDto;
  currentUserName: string | null;
  locked: boolean;
  approving: boolean;
  requesting: boolean;
  onApprove: () => void;
  onRequestChanges: () => void;
}) {
  const canAct = !locked && plan.status === "Submitted" && !plan.isSelfApprovalDataIssue;
  const lastChangeRequest = latestChangeRequest(plan);
  const lastReferencedObjectives = lastChangeRequest
    ? referencedObjectives(plan, lastChangeRequest.referencedObjectiveIds)
    : [];
  const referencedObjectiveIds = lastChangeRequest?.referencedObjectiveIds ?? [];
  const lastCommentTitle =
    lastChangeRequest && samePerson(lastChangeRequest.actorName, currentUserName)
      ? "Your last comment"
      : `Last comment from ${lastChangeRequest?.actorName ?? "manager"}`;
  return (
    <section className="min-w-0 space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill plan={plan} />
              {plan.isSelfApprovalDataIssue ? (
                <StatusBadge tone="warning" dot>
                  Data issue
                </StatusBadge>
              ) : null}
            </div>
            <h2 className="mt-2 text-wrap font-heading text-2xl font-semibold tracking-tight text-foreground">
              {plan.employeeName}
            </h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              <KeyValue label="Plan">{plan.objectiveCount} objectives</KeyValue>
              <KeyValue label="Weight">{plan.totalWeight}%</KeyValue>
              <KeyValue label="Submitted">
                {plan.submittedAt ? formatDate(plan.submittedAt) : "Not submitted"}
              </KeyValue>
            </dl>
          </div>

          <div className="border-t border-border bg-muted/25 p-5 lg:border-l lg:border-t-0">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ClipboardCheck className="size-4" />
              {locked ? "Locked review" : "Plan decision"}
            </p>
            {locked ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Planning is locked.
              </p>
            ) : (
              <div className="mt-3 grid gap-2">
                <Button
                  type="button"
                  disabled={!canAct || approving || requesting}
                  onClick={onApprove}
                >
                  <Check />
                  Approve plan
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canAct || requesting || approving}
                  onClick={onRequestChanges}
                >
                  <MessageSquareText />
                  Request changes
                </Button>
              </div>
            )}
          </div>
        </div>

        {plan.dataIssueMessage ? (
          <div className="mx-5 mb-5 rounded-xl border border-border bg-muted/40 p-3 text-sm text-foreground">
            {plan.dataIssueMessage}
          </div>
        ) : null}
        {lastChangeRequest?.comment ? (
          <div className="mx-5 mb-5 rounded-xl border border-border bg-muted/35 p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{lastCommentTitle}</p>
                <p className="mt-1 text-muted-foreground">{lastChangeRequest.comment}</p>
              </div>
              <ReferenceChips objectives={lastReferencedObjectives} />
            </div>
          </div>
        ) : null}
      </div>

      <ObjectiveReviewList objectives={plan.objectives} referencedObjectiveIds={referencedObjectiveIds} />
      <ReviewHistory plan={plan} />
    </section>
  );
}

function ObjectiveReviewList({
  objectives,
  referencedObjectiveIds,
}: {
  objectives: EmployeeObjectiveDto[];
  referencedObjectiveIds: string[];
}) {
  const referenced = new Set(referencedObjectiveIds);
  const totalWeight = objectives.reduce((sum, objective) => sum + (objective.weight ?? 0), 0);
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Objectives</h3>
          <p className="text-sm text-muted-foreground">
            {objectives.length} items · {totalWeight}% weight
          </p>
        </div>
        {referencedObjectiveIds.length > 0 ? (
          <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground">
            {referencedObjectiveIds.length} referenced
          </span>
        ) : null}
      </div>
      <ul className="divide-y divide-border">
        {objectives.map((objective, index) => {
          const isReferenced = referenced.has(objective.id);
          return (
            <li
              key={objective.id}
              className={cn("px-4 py-4", isReferenced && "bg-muted/35")}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                    isReferenced
                      ? "border-foreground/25 bg-background text-foreground"
                      : "border-border bg-muted/35 text-muted-foreground",
                  )}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                    <h4 className="min-w-0 text-wrap font-semibold text-foreground">
                      {objective.title}
                    </h4>
                    {isReferenced ? (
                      <span className="rounded-full border border-foreground/20 bg-background px-2 py-0.5 text-[11px] font-medium text-foreground">
                        Referenced
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{objective.alignmentTitle ?? "No alignment"}</span>
                    <span>{objective.measurementMethod ? measurementMethodLabel(objective.measurementMethod) : "No method"}</span>
                    <span>{describeMeasurement(objective)}</span>
                    <span>{objective.deadline ? formatDate(objective.deadline) : "No due date"}</span>
                  </div>
                </div>
                <p className="shrink-0 text-right font-heading text-2xl font-semibold leading-none tabular-nums text-foreground">
                  {objective.weight ?? 0}
                  <span className="text-base text-muted-foreground">%</span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ReviewHistory({ plan }: { plan: PlanApprovalReviewDto }) {
  return (
    <details className="group rounded-xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        <span className="text-sm font-semibold text-foreground">Activity</span>
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {plan.reviewHistory.length} events
          <ChevronRight className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
        </span>
      </summary>
      {plan.reviewHistory.length === 0 ? (
        <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
          No review events yet.
        </p>
      ) : (
        <ol className="space-y-3 border-t border-border px-4 py-3">
          {plan.reviewHistory.map((event) => (
            <li key={event.id} className="flex gap-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-border" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p className="text-sm font-medium text-foreground">{reviewEventLabel(event.type)}</p>
                  <p className="text-xs text-muted-foreground">
                    {event.actorName} · {formatDate(event.occurredAt)}
                  </p>
                </div>
                {event.comment ? (
                  <div className="mt-1.5 rounded-lg bg-muted/35 px-3 py-2 text-sm text-foreground">
                    <p>{event.comment}</p>
                    {event.type === "ChangesRequested" ? (
                      <div className="mt-2">
                        <ReferenceChips
                          objectives={referencedObjectives(plan, event.referencedObjectiveIds)}
                          compact
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}

function RequestChangesDialog({
  plan,
  isSaving,
  onClose,
  onSubmit,
}: {
  plan: PlanApprovalReviewDto | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (request: RequestObjectivePlanChangesRequest) => void;
}) {
  const [comment, setComment] = useState("");
  const [referencedObjectiveIds, setReferencedObjectiveIds] = useState<string[]>([]);
  const trimmed = comment.trim();
  const allSelected = !!plan && referencedObjectiveIds.length === plan.objectives.length;

  useEffect(() => {
    setComment("");
    setReferencedObjectiveIds([]);
  }, [plan?.planId]);

  const toggleObjective = (objectiveId: string) => {
    setReferencedObjectiveIds((current) =>
      current.includes(objectiveId)
        ? current.filter((id) => id !== objectiveId)
        : [...current, objectiveId],
    );
  };

  return (
    <Dialog
      open={!!plan}
      onOpenChange={(open) => {
        if (!open && !isSaving) {
          setComment("");
          setReferencedObjectiveIds([]);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request changes from {plan?.employeeName ?? "employee"}</DialogTitle>
          <DialogDescription>Full plan returns to employee.</DialogDescription>
        </DialogHeader>
        {plan ? (
          <div className="space-y-3 rounded-xl border border-border bg-muted/25 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">References</p>
                <p className="text-xs text-muted-foreground">
                  {referencedObjectiveIds.length > 0
                    ? `${referencedObjectiveIds.length} selected · full plan returns`
                    : "Plan-wide · full plan returns"}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={isSaving || allSelected}
                  onClick={() => setReferencedObjectiveIds(plan.objectives.map((objective) => objective.id))}
                >
                  All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={isSaving || referencedObjectiveIds.length === 0}
                  onClick={() => setReferencedObjectiveIds([])}
                >
                  Clear
                </Button>
              </div>
            </div>
            <ul className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {plan.objectives.map((objective) => (
                <li key={objective.id}>
                  <label
                    htmlFor={`request-change-objective-${objective.id}`}
                    className={cn(
                      "flex h-full cursor-pointer items-start gap-2.5 rounded-lg border bg-card p-3 text-sm transition-colors",
                      referencedObjectiveIds.includes(objective.id)
                        ? "border-primary/60 bg-primary/[0.06]"
                        : "border-border hover:bg-muted/45",
                    )}
                  >
                    <Checkbox
                      id={`request-change-objective-${objective.id}`}
                      checked={referencedObjectiveIds.includes(objective.id)}
                      disabled={isSaving}
                      onCheckedChange={() => toggleObjective(objective.id)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-foreground">{objective.title}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {objective.weight ?? 0}% · {objective.alignmentTitle ?? "No alignment"}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="space-y-2">
          <label htmlFor="request-changes-comment" className="text-sm font-medium text-foreground">
            Manager comment
          </label>
          <Textarea
            id="request-changes-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Clarify the measurement for Improve delivery quality."
            rows={4}
          />
          {!trimmed ? (
            <p className="text-xs text-muted-foreground">Required.</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={isSaving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!trimmed || isSaving}
            onClick={() => {
              onSubmit({
                comment: trimmed,
                referencedObjectiveIds,
              });
              setComment("");
              setReferencedObjectiveIds([]);
            }}
          >
            <SendHorizonal />
            Request changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReferenceChips({
  objectives,
  compact,
}: {
  objectives: EmployeeObjectiveDto[];
  compact?: boolean;
}) {
  if (objectives.length === 0) {
    return (
      <span className="inline-flex h-6 shrink-0 items-center rounded-full border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground">
        Full plan
      </span>
    );
  }

  const shown = compact ? objectives.slice(0, 1) : objectives.slice(0, 2);
  const overflow = objectives.length - shown.length;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
      {shown.map((objective) => (
        <span
          key={objective.id}
          className="inline-flex max-w-44 items-center rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground"
        >
          <span className="truncate">{objective.title}</span>
        </span>
      ))}
      {overflow > 0 ? (
        <span className="inline-flex h-6 items-center rounded-full border border-border bg-card px-2 text-xs font-medium text-muted-foreground">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

function latestChangeRequest(plan: PlanApprovalReviewDto) {
  return [...plan.reviewHistory]
    .filter((event) => event.type === "ChangesRequested")
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())[0] ?? null;
}

function referencedObjectives(plan: PlanApprovalReviewDto, referencedObjectiveIds: string[]) {
  if (referencedObjectiveIds.length === 0) return [];
  const referenced = new Set(referencedObjectiveIds);
  return plan.objectives.filter((objective) => referenced.has(objective.id));
}

function samePerson(left: string | null | undefined, right: string | null | undefined) {
  return Boolean(left && right && left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase());
}

function ReviewMeter({ workspace }: { workspace: PlanApprovalWorkspaceDto }) {
  return (
    <div className="flex items-center gap-2.5">
      <Metric value={workspace.waitingForReviewCount} label="waiting" />
      <Metric value={workspace.changesRequestedCount} label="returned" />
      <Metric value={workspace.approvedCount} label="approved" />
    </div>
  );
}

function StatusPill({ plan }: { plan: PlanApprovalReviewDto }) {
  if (plan.isSelfApprovalDataIssue) return <StatusBadge tone="warning" dot>Blocked</StatusBadge>;
  if (plan.status === "Approved") return <StatusBadge tone="success" dot>Approved</StatusBadge>;
  if (plan.status === "ChangesRequested") return <StatusBadge tone="info" dot>Returned</StatusBadge>;
  return <StatusBadge tone="warning" dot>Waiting</StatusBadge>;
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="font-heading text-3xl font-semibold leading-none tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function KeyValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 min-w-0 font-medium text-foreground">{children}</dd>
    </div>
  );
}

function describeMeasurement(objective: EmployeeObjectiveDto): string {
  if (!objective.measurementMethod) return "Not set";
  if (objective.measurementMethod === "Quantitative") {
    const target = [objective.targetValue, objective.targetUnit].filter(Boolean).join(" ");
    if (objective.measurementIndicator && target) return `${objective.measurementIndicator}: ${target}`;
    return objective.measurementIndicator ?? measurementMethodLabel(objective.measurementMethod);
  }
  return objective.successCriteria ?? measurementMethodLabel(objective.measurementMethod);
}

function reviewEventLabel(type: string): string {
  if (type === "ChangesRequested") return "Changes requested";
  if (type === "Resubmitted") return "Resubmitted";
  if (type === "Approved") return "Approved";
  return "Submitted";
}

function errorMessage(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 409 || error.status === 412 || error.status === 428) {
      return "This plan changed. Review the latest version and try again.";
    }
    return error.errors[0] ?? error.message;
  }
  return error.message;
}

function PlanApprovalListSkeleton() {
  return (
    <PageContainer>
      <div className="space-y-5" aria-busy aria-label="Loading plan approvals">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    </PageContainer>
  );
}

function PlanApprovalWorkspaceSkeleton() {
  return (
    <PageContainer>
      <div className="space-y-5" aria-busy aria-label="Loading approval workspace">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-5 xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
          <div className="space-y-2">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-56 rounded-xl" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
