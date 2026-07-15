"use client";

import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  Bell,
  CalendarClock,
  ChevronRight,
  CircleAlert,
  Lock,
  Search,
  Shuffle,
  UserMinus,
} from "lucide-react";
import {
  ApiError,
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
} from "@repo/api";
import type {
  ExcludePlanningParticipantRequest,
  LockPlanningRequest,
  PlanningCompletionParticipantDto,
  PlanningCompletionParticipantDetailDto,
  PlanningCompletionWorkspaceDto,
  ReassignPlanningReviewerRequest,
  RecordPlanningReminderRequest,
} from "@repo/api";
import { useApiMutation, useApiQuery } from "@repo/api/query";
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
import { Button } from "@/components/ui/button";
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
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PeopleCombobox, type PersonOption } from "@/components/campaigns/people-combobox";
import { ConfirmDialog } from "@/components/controls/confirm-dialog";
import { formatDate } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const statusOptions = [
  ["all", "All"],
  ["blocked", "Blocked"],
  ["submitted", "Submitted"],
  ["changes-requested", "Changes requested"],
  ["draft", "Draft"],
  ["not-started", "Not started"],
  ["approved", "Approved"],
  ["excluded", "Excluded"],
] as const;

const PARTICIPANT_QUEUE_LIMIT = 10;

export function PlanningCompletionPage() {
  const params = useParams<{ slug?: string }>();
  const slug = params.slug ?? "";
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const canView = canViewPerformanceCampaigns(user);
  const canManage = canManagePerformanceCampaigns(user);
  const canOperate = canOperatePerformanceCycles(user);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | "reminder" | "reassign" | "exclude" | "lock" | "lock-confirm">(null);

  const queryParams = { status, search, page: 1, pageSize: 80 };
  const { data: workspace, error, isLoading, refetch } =
    useApiQuery<PlanningCompletionWorkspaceDto>(
      performanceQueryKeys.planningCompletionWorkspace(slug, queryParams),
      (signal) =>
        apiClient.get<PlanningCompletionWorkspaceDto>(
          performancePaths.planningCompletionWorkspace(slug),
          {
            signal,
            params: {
              status: status === "all" ? undefined : status,
              search: search || undefined,
              page: 1,
              pageSize: 80,
            },
          },
        ),
      { enabled: canView && !!slug },
    );

  const selected =
    workspace?.participants.items.find((item) => item.participantEmployeeId === selectedEmployeeId) ??
    workspace?.participants.items[0] ??
    null;

  const { data: detail, refetch: refetchDetail } =
    useApiQuery<PlanningCompletionParticipantDetailDto>(
      selected
        ? performanceQueryKeys.planningCompletionParticipant(workspace?.cycleId ?? "", selected.participantEmployeeId)
        : performanceQueryKeys.planningCompletionParticipant("", ""),
      (signal) =>
        apiClient.get<PlanningCompletionParticipantDetailDto>(
          performancePaths.planningCompletionParticipant(workspace?.cycleId ?? "", selected?.participantEmployeeId ?? ""),
          { signal },
        ),
      { enabled: canView && !!workspace?.cycleId && !!selected },
    );

  const refresh = async () => {
    await refetch();
    await refetchDetail();
  };

  const reminder = useApiMutation<PlanningCompletionParticipantDetailDto, RecordPlanningReminderRequest>(
    (request) =>
      apiClient.post<PlanningCompletionParticipantDetailDto>(
        performancePaths.planningCompletionReminder(workspace?.cycleId ?? ""),
        request,
      ),
    {
      onSuccess: async () => {
        toast.success("Reminder recorded");
        setDialog(null);
        await refresh();
      },
      onError: (mutationError) => {
        toast.error(errorMessage(mutationError));
      },
    },
  );

  const reassign = useApiMutation<PlanningCompletionParticipantDetailDto, ReassignPlanningReviewerRequest>(
    (request) =>
      apiClient.post<PlanningCompletionParticipantDetailDto>(
        performancePaths.planningCompletionReassignReviewer(
          workspace?.cycleId ?? "",
          selected?.participantEmployeeId ?? "",
        ),
        request,
      ),
    {
      onSuccess: async () => {
        toast.success("Reviewer reassigned");
        setDialog(null);
        await refresh();
      },
      onError: (mutationError) => {
        toast.error(errorMessage(mutationError));
      },
    },
  );

  const exclude = useApiMutation<PlanningCompletionParticipantDetailDto, ExcludePlanningParticipantRequest>(
    (request) =>
      apiClient.post<PlanningCompletionParticipantDetailDto>(
        performancePaths.planningCompletionExcludeParticipant(
          workspace?.cycleId ?? "",
          selected?.participantEmployeeId ?? "",
        ),
        request,
      ),
    {
      onSuccess: async () => {
        toast.success("Participant excluded");
        setDialog(null);
        await refresh();
      },
      onError: (mutationError) => {
        toast.error(errorMessage(mutationError));
      },
    },
  );

  const lockPlanning = useApiMutation<PlanningCompletionWorkspaceDto, LockPlanningRequest>(
    (request) =>
      apiClient.post<PlanningCompletionWorkspaceDto>(
        performancePaths.planningCompletionLock(workspace?.cycleId ?? ""),
        request,
        { headers: { "If-Match": `"${workspace?.version ?? 0}"` } },
      ),
    {
      onSuccess: async () => {
        toast.success("Planning locked");
        setDialog(null);
        await refresh();
      },
      onError: async (mutationError) => {
        toast.error(errorMessage(mutationError));
        await refresh();
      },
    },
  );

  if (authLoading) return <CompletionSkeleton />;

  if (!canView) {
    return (
      <PageContainer>
        <PageHeader title="Planning completion" />
        <PagePermissionNotice title="Campaign access required" />
      </PageContainer>
    );
  }

  if (isLoading) return <CompletionSkeleton />;

  if (error || !workspace) {
    const statusCode = error instanceof ApiError ? error.status : 0;
    return (
      <PageContainer>
        <PageHeader title="Planning completion" />
        {statusCode === 403 ? (
          <PagePermissionNotice title="Campaign access required" />
        ) : (
          <PageError
            title={statusCode === 404 ? "Campaign not found" : "Could not load completion"}
            description={statusCode === 404 ? "It may have been removed, or the link is wrong." : "Try again."}
            onRetry={statusCode === 404 ? undefined : refetch}
          />
        )}
      </PageContainer>
    );
  }

  const isLocked = workspace.state === "locked";
  const actionsEnabled = canManage && !isLocked && workspace.state !== "not-launched" && !!selected;
  const canLock = canOperate && workspace.summary.isReadyToLock && !isLocked;

  return (
    <PageContainer>
      <PageHeader
        title={workspace.name}
        eyebrow={<CompletionStateBadge workspace={workspace} />}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {workspace.referenceYear ? <span>{workspace.referenceYear}</span> : null}
            {workspace.expectedPlanningLockDate ? (
              <span className="flex items-center gap-1.5">
                <CalendarClock className="size-3.5" />
                Lock target {formatDate(workspace.expectedPlanningLockDate)}
              </span>
            ) : null}
          </span>
        }
        actions={
          canLock ? (
            <Button size="sm" onClick={() => setDialog("lock")}>
              <Lock />
              Lock planning
            </Button>
          ) : null
        }
      />

      {workspace.state === "not-launched" ? (
        <PageEmpty title="Launch required" description="Planning completion starts after campaign launch." />
      ) : (
        <div className="space-y-5">
          <CompletionOverview workspace={workspace} />

          <div className="grid gap-5 xl:grid-cols-[minmax(20rem,28rem)_minmax(0,1fr)]">
            <section className="min-w-0 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search participants"
                    className="pl-8"
                  />
                </div>
                <NativeSelect value={status} onChange={(event) => setStatus(event.target.value)} className="sm:w-48">
                  {statusOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <ParticipantQueue
                participants={workspace.participants.items}
                totalCount={workspace.participants.totalCount}
                selectedId={selected?.participantEmployeeId ?? null}
                onSelect={setSelectedEmployeeId}
              />
            </section>

            <ParticipantDetail
              participant={detail?.participant ?? selected}
              detail={detail}
              locked={isLocked}
              actionsEnabled={actionsEnabled}
              canManage={canManage}
              onReminder={() => setDialog("reminder")}
              onReassign={() => setDialog("reassign")}
              onExclude={() => setDialog("exclude")}
            />
          </div>
        </div>
      )}

      <ReminderDialog
        open={dialog === "reminder"}
        participant={selected}
        isSaving={reminder.isLoading}
        onClose={() => setDialog(null)}
        onSubmit={(request) => reminder.mutate(request)}
      />
      <ReassignDialog
        open={dialog === "reassign"}
        participant={selected}
        isSaving={reassign.isLoading}
        onClose={() => setDialog(null)}
        onSubmit={(request) => reassign.mutate(request)}
      />
      <ExcludeDialog
        open={dialog === "exclude"}
        participant={selected}
        isSaving={exclude.isLoading}
        onClose={() => setDialog(null)}
        onSubmit={(request) => exclude.mutate(request)}
      />
      <LockDialog
        open={dialog === "lock"}
        workspace={workspace}
        isSaving={lockPlanning.isLoading}
        onClose={() => setDialog(null)}
        onSubmit={() => setDialog("lock-confirm")}
      />
      <ConfirmDialog
        open={dialog === "lock-confirm"}
        onOpenChange={(open) => (!open && !lockPlanning.isLoading ? setDialog("lock") : undefined)}
        title="Lock planning?"
        description={`This will freeze ${workspace.summary.approvedCount} approved and ${workspace.summary.excludedCount} excluded employee plans for ${workspace.name}.`}
        confirmLabel="Lock planning"
        cancelLabel="Back"
        onConfirm={() => lockPlanning.mutate({ confirmation: "LOCK" })}
      />
    </PageContainer>
  );
}

function CompletionOverview({ workspace }: { workspace: PlanningCompletionWorkspaceDto }) {
  const { summary } = workspace;
  const denominator = Math.max(1, summary.totalParticipants);
  const approvedWidth = (summary.approvedCount / denominator) * 100;
  const excludedWidth = (summary.excludedCount / denominator) * 100;
  const remainingWidth = Math.max(0, 100 - approvedWidth - excludedWidth);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={summary.isReadyToLock ? "success" : summary.blockedCount > 0 ? "warning" : "info"} dot>
              {summary.isReadyToLock ? "Ready to lock" : `${summary.remainingCount} remaining`}
            </StatusBadge>
            {workspace.planningLockedAt ? (
              <span className="text-sm text-muted-foreground">
                Locked by {workspace.planningLockedByName ?? "HR"} on {formatDate(workspace.planningLockedAt)}
              </span>
            ) : null}
          </div>
          <div className="mt-4 flex h-4 overflow-hidden rounded-full border border-border bg-muted">
            <span style={{ width: `${approvedWidth}%` }} className="bg-emerald-500/75" />
            <span style={{ width: `${excludedWidth}%` }} className="bg-muted-foreground/45" />
            <span style={{ width: `${remainingWidth}%` }} className="bg-primary/55" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-5 text-right">
          <Metric value={summary.approvedCount} label="approved" />
          <Metric value={summary.excludedCount} label="excluded" />
          <Metric value={summary.remainingCount} label="remaining" />
        </div>
      </div>
      {workspace.remainingGroups.length > 0 && !workspace.summary.isReadyToLock ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {workspace.remainingGroups.map((group) => (
            <span
              key={group.code}
              className="inline-flex items-center rounded-full border border-border bg-muted/35 px-2.5 py-1 text-xs font-medium text-foreground"
            >
              {group.label}: {group.count}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ParticipantQueue({
  participants,
  totalCount,
  selectedId,
  onSelect,
}: {
  participants: PlanningCompletionParticipantDto[];
  totalCount: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (participants.length === 0) {
    return <PageEmpty title="No matching participants" description="Adjust filters or search." />;
  }

  const visibleParticipants = participants.slice(0, PARTICIPANT_QUEUE_LIMIT);
  const hiddenCount = Math.max(0, totalCount - visibleParticipants.length);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border bg-muted/25 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Employee plans</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Participants are employees in this campaign. Reviewers are shown in the detail panel.
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium tabular-nums text-foreground">
            {totalCount}
          </span>
        </div>
      </div>
      {visibleParticipants.map((participant) => (
        <button
          key={participant.participantEmployeeId}
          type="button"
          onClick={() => onSelect(participant.participantEmployeeId)}
          className={cn(
            "flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
            selectedId === participant.participantEmployeeId && "bg-primary/[0.06]",
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-foreground">{participant.employeeName}</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {[participant.jobTitle, participant.orgUnitName].filter(Boolean).join(" · ") || "Employee participant"}
            </span>
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {participant.isOverdue ? <CircleAlert className="size-4 text-amber-700 dark:text-primary" /> : null}
            <ParticipantStatusBadge participant={participant} />
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        </button>
      ))}
      {hiddenCount > 0 ? (
        <div className="border-t border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          Showing the first {visibleParticipants.length} employee plans. Use search or status filters to narrow the
          remaining {hiddenCount}.
        </div>
      ) : null}
    </div>
  );
}

function ParticipantDetail({
  participant,
  detail,
  locked,
  actionsEnabled,
  canManage,
  onReminder,
  onReassign,
  onExclude,
}: {
  participant: PlanningCompletionParticipantDto | null;
  detail?: PlanningCompletionParticipantDetailDto;
  locked: boolean;
  actionsEnabled: boolean;
  canManage: boolean;
  onReminder: () => void;
  onReassign: () => void;
  onExclude: () => void;
}) {
  if (!participant) {
    return <PageEmpty title="No participant selected" description="Select a participant to inspect closure state." />;
  }

  return (
    <section className="min-w-0 space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <ParticipantStatusBadge participant={participant} />
            <h2 className="mt-2 text-wrap font-heading text-2xl font-semibold tracking-tight text-foreground">
              {participant.employeeName}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {[participant.jobTitle, participant.orgUnitName].filter(Boolean).join(" · ") || "Campaign participant"}
            </p>
          </div>
          {locked ? <StatusBadge tone="success">Locked baseline</StatusBadge> : null}
        </div>

        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <KeyValue label="Plan">{participant.plan?.statusLabel ?? "Not started"}</KeyValue>
          <KeyValue label="Reviewer">{participant.effectiveReviewer.name ?? "Missing"}</KeyValue>
          <KeyValue label="Frozen approver">{participant.frozenReviewer.name ?? "Missing"}</KeyValue>
          <KeyValue label="Last activity">
            {participant.lastActivityAt ? formatDate(participant.lastActivityAt) : "None"}
          </KeyValue>
        </dl>

        {participant.reviewerWasReassigned ? (
          <div className="mt-4 rounded-xl border border-border bg-muted/35 p-3 text-sm">
            <span className="font-medium text-foreground">{participant.effectiveReviewer.name}</span>
            <span className="text-muted-foreground"> now reviews this plan.</span>
          </div>
        ) : null}

        {participant.blockers.length > 0 ? (
          <div className="mt-4 space-y-2">
            {participant.blockers.map((blocker) => (
              <div key={blocker.code} className="flex items-center gap-2 text-sm text-foreground">
                <CircleAlert className="size-4 text-amber-700 dark:text-primary" />
                {blocker.label}
              </div>
            ))}
          </div>
        ) : null}

        {participant.exclusion ? (
          <div className="mt-4 rounded-xl border border-border bg-muted/35 p-3 text-sm">
            <p className="font-medium text-foreground">Excluded by {participant.exclusion.excludedByName ?? "HR"}</p>
            <p className="mt-1 text-muted-foreground">{participant.exclusion.reason}</p>
          </div>
        ) : null}

        {canManage ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={!actionsEnabled} onClick={onReminder}>
              <Bell />
              Reminder
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!actionsEnabled} onClick={onReassign}>
              <Shuffle />
              Reassign reviewer
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!actionsEnabled || participant.isExcluded} onClick={onExclude}>
              <UserMinus />
              Exclude
            </Button>
          </div>
        ) : null}
      </div>

      <HistoryPanel detail={detail} />
    </section>
  );
}

function HistoryPanel({ detail }: { detail?: PlanningCompletionParticipantDetailDto }) {
  const reminders = detail?.reminderHistory ?? [];
  const reassignments = detail?.reassignmentHistory ?? [];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Reminders</h3>
        {reminders.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">None recorded.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {reminders.slice(0, 4).map((item) => (
              <li key={item.id} className="text-sm">
                <p className="font-medium text-foreground">{item.targetName}</p>
                <p className="text-muted-foreground">{item.reason}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Reviewer history</h3>
        {reassignments.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Frozen approver unchanged.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {reassignments.slice(0, 4).map((item) => (
              <li key={item.id} className="text-sm">
                <p className="font-medium text-foreground">{item.newApproverName}</p>
                <p className="text-muted-foreground">{item.reason}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function ReminderDialog({
  open,
  participant,
  isSaving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  participant: PlanningCompletionParticipantDto | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (request: RecordPlanningReminderRequest) => void;
}) {
  const [target, setTarget] = useState<"employee" | "reviewer">("employee");
  const [reason, setReason] = useState("");
  const targetEmployeeId =
    target === "reviewer"
      ? participant?.effectiveReviewer.employeeId
      : participant?.participantEmployeeId;

  return (
    <ReasonDialog
      open={open}
      title="Record reminder"
      reason={reason}
      isSaving={isSaving}
      onReason={setReason}
      onClose={onClose}
      actionLabel="Record reminder"
      beforeReason={
        <NativeSelect value={target} onChange={(event) => setTarget(event.target.value as "employee" | "reviewer")}>
          <option value="employee">Employee</option>
          <option value="reviewer">Reviewer</option>
        </NativeSelect>
      }
      onSubmit={() => {
        if (!participant || !targetEmployeeId) return;
        onSubmit({
          participantEmployeeId: participant.participantEmployeeId,
          planId: participant.plan?.planId ?? null,
          targetEmployeeId,
          targetType: target === "reviewer" ? "Reviewer" : "Participant",
          reason: reason.trim(),
        });
        setReason("");
      }}
    />
  );
}

function ReassignDialog({
  open,
  participant,
  isSaving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  participant: PlanningCompletionParticipantDto | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (request: ReassignPlanningReviewerRequest) => void;
}) {
  const [person, setPerson] = useState<PersonOption | null>(null);
  const [reason, setReason] = useState("");
  return (
    <ReasonDialog
      open={open}
      title="Reassign reviewer"
      reason={reason}
      isSaving={isSaving}
      onReason={setReason}
      onClose={onClose}
      actionLabel="Reassign"
      beforeReason={
        <PeopleCombobox
          value={person}
          onSelect={setPerson}
          placeholder="Choose reviewer"
          disabled={isSaving}
          excludeIds={participant ? [participant.participantEmployeeId] : undefined}
        />
      }
      onSubmit={() => {
        if (!person) return;
        onSubmit({ newApproverEmployeeId: person.employeeId, reason: reason.trim() });
        setPerson(null);
        setReason("");
      }}
      submitDisabled={!person}
    />
  );
}

function ExcludeDialog({
  open,
  participant,
  isSaving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  participant: PlanningCompletionParticipantDto | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (request: ExcludePlanningParticipantRequest) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <ReasonDialog
      open={open}
      title={participant ? `Exclude ${participant.employeeName}` : "Exclude participant"}
      reason={reason}
      isSaving={isSaving}
      onReason={setReason}
      onClose={onClose}
      actionLabel="Exclude"
      onSubmit={() => {
        onSubmit({ reason: reason.trim() });
        setReason("");
      }}
    />
  );
}

function LockDialog({
  open,
  workspace,
  isSaving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  workspace: PlanningCompletionWorkspaceDto;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (!next && !isSaving ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lock planning</DialogTitle>
          <DialogDescription>
            Review the completion counts before opening the final confirmation.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 rounded-xl border border-border bg-muted/30 p-3 text-sm">
          <KeyValue label="Approved">{workspace.summary.approvedCount}</KeyValue>
          <KeyValue label="Excluded">{workspace.summary.excludedCount}</KeyValue>
          <KeyValue label="Remaining">{workspace.summary.remainingCount}</KeyValue>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={isSaving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSaving}
            onClick={onSubmit}
          >
            <Lock />
            Lock planning
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReasonDialog({
  open,
  title,
  reason,
  isSaving,
  onReason,
  onClose,
  onSubmit,
  actionLabel,
  beforeReason,
  submitDisabled,
}: {
  open: boolean;
  title: string;
  reason: string;
  isSaving: boolean;
  onReason: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  actionLabel: string;
  beforeReason?: ReactNode;
  submitDisabled?: boolean;
}) {
  const trimmed = reason.trim();
  return (
    <Dialog open={open} onOpenChange={(next) => (!next && !isSaving ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {beforeReason}
        <div className="space-y-2">
          <Label htmlFor={`${title}-reason`}>Reason</Label>
          <Textarea
            id={`${title}-reason`}
            value={reason}
            onChange={(event) => onReason(event.target.value)}
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={isSaving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!trimmed || isSaving || submitDisabled}
            onClick={onSubmit}
          >
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompletionStateBadge({ workspace }: { workspace: PlanningCompletionWorkspaceDto }) {
  if (workspace.state === "locked") return <StatusBadge tone="success" dot>Locked</StatusBadge>;
  if (workspace.state === "ready-to-lock") return <StatusBadge tone="success" dot>Ready</StatusBadge>;
  if (workspace.state === "blocked") return <StatusBadge tone="warning" dot>Blocked</StatusBadge>;
  if (workspace.state === "not-launched") return <StatusBadge tone="info" dot>Not launched</StatusBadge>;
  return <StatusBadge tone="info" dot>In progress</StatusBadge>;
}

function ParticipantStatusBadge({ participant }: { participant: PlanningCompletionParticipantDto }) {
  const tone =
    participant.status === "approved" || participant.status === "excluded"
      ? "success"
      : participant.status === "blocked" || participant.status === "changes-requested"
        ? "warning"
        : "info";
  return <StatusBadge tone={tone} dot>{participant.statusLabel}</StatusBadge>;
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="font-heading text-3xl font-semibold leading-none tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-foreground">{children}</dd>
    </div>
  );
}

function CompletionSkeleton() {
  return (
    <PageContainer>
      <PageLoading rows={5} label="Loading planning completion" />
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(20rem,28rem)_minmax(0,1fr)]">
        <div className="space-y-3">
          <Skeleton className="h-10 rounded-md" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </PageContainer>
  );
}

function errorMessage(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 409 || error.status === 412 || error.status === 428) {
      return error.errors[0] ?? "This campaign changed. Refresh and try again.";
    }
    return error.errors[0] ?? error.message;
  }
  return error.message;
}
