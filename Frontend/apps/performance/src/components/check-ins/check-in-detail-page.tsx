"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  CircleSlash,
  ClipboardList,
  History,
  MessageSquare,
  Pencil,
} from "lucide-react";
import {
  ApiError,
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
  type AddCheckInAddendumRequest,
  type CancelCheckInRequest,
  type CheckInDetailDto,
  type CheckInMutationResult,
  type CompleteCheckInRequest,
  type FollowUpActionDto,
  type FollowUpActionMutationResult,
  type RescheduleCheckInRequest,
} from "@repo/api";
import { useApiMutation, useApiQuery } from "@repo/api/query";
import { canAccessTeamProgress, useAuth } from "@repo/auth";
import {
  PageContainer,
  PageError,
  PageHeader,
  PageListSkeleton,
  PagePermissionNotice,
} from "@repo/ds/shell";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateTime } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { checkInTerms, ownerLabel } from "./check-in-terms";
import {
  ActionStatusBadge,
  CheckInStatusBadge,
  formatCheckInWhen,
} from "./check-in-visuals";
import { CompleteCheckInDialog } from "./complete-check-in-dialog";

export function CheckInDetailPage() {
  const params = useParams<{ slug?: string; checkInId?: string }>();
  const slug = params.slug ?? "";
  const checkInId = params.checkInId ?? "";
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const canView = canAccessTeamProgress(user);

  const detailKey = performanceQueryKeys.checkInDetail(checkInId);
  const { data, error, isLoading, refetch } = useApiQuery<CheckInDetailDto>(
    detailKey,
    (signal) =>
      apiClient.get<CheckInDetailDto>(
        performancePaths.checkInDetail(checkInId),
        {
          signal,
        }
      ),
    { enabled: canView }
  );

  const [action, setAction] = useState<
    "reschedule" | "cancel" | "complete" | null
  >(null);
  const [actionErrors, setActionErrors] = useState<string[]>([]);
  const [addendum, setAddendum] = useState("");

  const invalidate = [{ queryKey: detailKey }];

  const reschedule = useApiMutation<
    CheckInMutationResult,
    RescheduleCheckInRequest
  >(
    (request) =>
      apiClient.post<CheckInMutationResult>(
        performancePaths.rescheduleCheckIn(checkInId),
        request
      ),
    {
      invalidateQueries: invalidate,
      onSuccess: () => {
        toast.success("Check-in rescheduled");
        setAction(null);
      },
      onError: (mutationError) => setActionErrors(errorMessages(mutationError)),
    }
  );

  const cancel = useApiMutation<CheckInMutationResult, CancelCheckInRequest>(
    (request) =>
      apiClient.post<CheckInMutationResult>(
        performancePaths.cancelCheckIn(checkInId),
        request
      ),
    {
      invalidateQueries: invalidate,
      onSuccess: () => {
        toast.success("Check-in cancelled");
        setAction(null);
      },
      onError: (mutationError) => setActionErrors(errorMessages(mutationError)),
    }
  );

  const complete = useApiMutation<
    CheckInMutationResult,
    CompleteCheckInRequest
  >(
    (request) =>
      apiClient.post<CheckInMutationResult>(
        performancePaths.completeCheckIn(checkInId),
        request
      ),
    {
      invalidateQueries: invalidate,
      onSuccess: () => {
        toast.success("Check-in completed");
        setAction(null);
      },
      onError: (mutationError) => setActionErrors(errorMessages(mutationError)),
    }
  );

  const addNote = useApiMutation<
    CheckInMutationResult,
    AddCheckInAddendumRequest
  >(
    (request) =>
      apiClient.post<CheckInMutationResult>(
        performancePaths.addCheckInAddendum(checkInId),
        request
      ),
    {
      invalidateQueries: invalidate,
      onSuccess: () => {
        toast.success("Note added");
        setAddendum("");
      },
      onError: (mutationError) =>
        void toast.error(
          errorMessages(mutationError)[0] ?? checkInTerms.genericError
        ),
    }
  );

  const completeAction = useApiMutation<
    FollowUpActionMutationResult,
    FollowUpActionDto
  >(
    (item) =>
      apiClient.post<FollowUpActionMutationResult>(
        performancePaths.completeFollowUpAction(item.id),
        { expectedVersion: item.version, note: null }
      ),
    {
      invalidateQueries: invalidate,
      onSuccess: () => void toast.success("Follow-up done"),
      onError: (mutationError) =>
        void toast.error(
          errorMessages(mutationError)[0] ?? checkInTerms.genericError
        ),
    }
  );

  if (authLoading || (isLoading && canView)) {
    return (
      <PageContainer>
        <PageHeader title={checkInTerms.conversationTitle} />
        <PageListSkeleton label="Loading check-in" />
      </PageContainer>
    );
  }

  if (!canView) {
    return (
      <PageContainer>
        <PageHeader title={checkInTerms.conversationTitle} />
        <PagePermissionNotice title="Check-in access required" />
      </PageContainer>
    );
  }

  if (error || !data) {
    const status = error instanceof ApiError ? error.status : 0;
    return (
      <PageContainer>
        <PageHeader title={checkInTerms.conversationTitle} />
        {status === 403 ? (
          <PagePermissionNotice title="Check-in access denied" />
        ) : (
          <PageError
            title={
              status === 404 ? "Check-in not found" : "Could not load check-in"
            }
            description={
              status === 404 ? "It may have been removed." : "Try again."
            }
            onRetry={status === 404 ? undefined : refetch}
          />
        )}
      </PageContainer>
    );
  }

  const isPlanned = data.status === "Planned";

  return (
    <PageContainer>
      <Link
        href={`/team-progress/${slug}`}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" />
        {checkInTerms.backToTeam}
      </Link>

      <div className="space-y-5">
        {/* Record header */}
        <section className="rounded-2xl border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold text-foreground">
                  {data.reason}
                </h1>
                <CheckInStatusBadge
                  status={data.status}
                  isOverdue={data.isOverdue}
                />
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-4" />
                  {formatCheckInWhen(data.plannedDate, data.plannedTime)}
                </span>
                <span>·</span>
                <span>{data.employeeName}</span>
                <span>·</span>
                <span>
                  {checkInTerms.createdBy(data.createdByReviewerName)}
                </span>
              </p>
            </div>
            {isPlanned ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActionErrors([]);
                    setAction("reschedule");
                  }}
                >
                  <Pencil className="size-4" />
                  {checkInTerms.reschedule}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActionErrors([]);
                    setAction("cancel");
                  }}
                >
                  <CircleSlash className="size-4" />
                  {checkInTerms.cancel}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setActionErrors([]);
                    setAction("complete");
                  }}
                >
                  {checkInTerms.markComplete}
                </Button>
              </div>
            ) : null}
          </div>

          {data.agenda ? (
            <div className="mt-4 rounded-xl bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                {checkInTerms.agendaLabel.replace(" (optional)", "")}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                {data.agenda}
              </p>
            </div>
          ) : null}

          {data.status === "Cancelled" && data.cancellationReason ? (
            <p className="mt-4 rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">
              {checkInTerms.cancelled} · {data.cancellationReason}
            </p>
          ) : null}
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] xl:gap-6">
          <div className="min-w-0 space-y-5">
            {/* Conversation content */}
            {isPlanned ? (
              <section className="rounded-2xl border border-dashed bg-muted/10 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <CalendarClock className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-foreground">
                      Ready for the conversation
                    </h2>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                      The outcome, response, and agreed follow-up will appear
                      here after the check-in.
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-medium text-foreground">
                      Prepare
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Review the agenda and objectives.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">
                      Discuss
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Use the check-in to align on next steps.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">
                      Capture
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Record the outcome and follow-up.
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {data.status === "Completed" ? (
              <Panel
                title="Outcome"
                icon={<MessageSquare className="size-4" />}
                meta={
                  data.completedAt
                    ? `${data.completedByReviewerName ?? ""} · ${formatDate(data.completedAt)}`
                    : undefined
                }
              >
                {data.completionSummary ? (
                  <p className="max-w-3xl whitespace-pre-wrap text-[0.95rem] leading-7 text-foreground">
                    {data.completionSummary}
                  </p>
                ) : null}
              </Panel>
            ) : null}

            {data.response ? (
              <Panel
                title={checkInTerms.responseTitle}
                icon={<MessageSquare className="size-4" />}
              >
                <blockquote className="max-w-3xl border-l-2 border-primary/40 pl-4 text-[0.95rem] leading-7 text-foreground">
                  {data.response.text}
                </blockquote>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatDateTime(data.response.createdAtUtc)}
                </p>
              </Panel>
            ) : null}

            {/* Addenda thread + add note (only after the check-in is completed) */}
            {data.status === "Completed" ? (
              <Panel
                title={checkInTerms.addendumTitle}
                icon={<MessageSquare className="size-4" />}
              >
                {data.addenda.length > 0 ? (
                  <ul className="mb-4 space-y-3">
                    {data.addenda.map((note) => (
                      <li
                        key={note.id}
                        className="border-b pb-3 text-sm last:border-b-0 last:pb-0"
                      >
                        <p className="whitespace-pre-wrap text-foreground">
                          {note.text}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {note.authorName} ·{" "}
                          {formatDateTime(note.createdAtUtc)}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="space-y-2">
                  <Textarea
                    value={addendum}
                    onChange={(event) => setAddendum(event.target.value)}
                    placeholder={checkInTerms.addendumPlaceholder}
                    maxLength={2000}
                    rows={3}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        addNote.isLoading || addendum.trim().length === 0
                      }
                      onClick={() => addNote.mutate({ text: addendum.trim() })}
                    >
                      {addNote.isLoading ? (
                        <Spinner className="size-4" />
                      ) : null}
                      {addNote.isLoading
                        ? checkInTerms.addingNote
                        : checkInTerms.addendumCta}
                    </Button>
                  </div>
                </div>
              </Panel>
            ) : null}
          </div>

          <aside className="min-w-0 space-y-4 lg:sticky lg:top-5">
            {/* Manager context rail */}
            <Panel
              title="At a glance"
              icon={<CalendarClock className="size-4" />}
              compact
            >
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Scheduled</dt>
                  <dd className="mt-0.5 text-foreground">
                    {formatCheckInWhen(data.plannedDate, data.plannedTime)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Employee</dt>
                  <dd className="mt-0.5 text-foreground">
                    {data.employeeName}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Planned by</dt>
                  <dd className="mt-0.5 text-foreground">
                    {data.createdByReviewerName}
                  </dd>
                </div>
              </dl>
            </Panel>

            {data.linkedObjectives.length > 0 ? (
              <Panel
                title="Objectives to review"
                icon={<ClipboardList className="size-4" />}
                compact
              >
                <ul className="space-y-2.5">
                  {data.linkedObjectives.map((objective) => (
                    <li
                      key={objective.objectiveId}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 text-foreground">
                        {objective.objectiveTitle}
                      </span>
                      {objective.wasDiscussed ? (
                        <span className="shrink-0 rounded-full bg-emerald-500/12 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          Covered
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}

            {data.actions.length > 0 ? (
              <Panel
                title={checkInTerms.actionsTitle}
                icon={<ClipboardList className="size-4" />}
                compact
              >
                <ul className="space-y-2.5">
                  {data.actions.map((item) => (
                    <li
                      key={item.id}
                      className="border-b pb-2.5 last:border-b-0 last:pb-0"
                    >
                      <p className="text-sm text-foreground">
                        {item.description}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>{ownerLabel(item.ownerKind)}</span>
                        <span aria-hidden>·</span>
                        <span>
                          {checkInTerms.actionDueLabel}{" "}
                          {formatDate(item.dueDate)}
                        </span>
                        <ActionStatusBadge
                          status={item.status}
                          isOverdue={item.isOverdue}
                        />
                      </p>
                      {item.resolutionNote ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.resolutionNote}
                        </p>
                      ) : null}
                      {item.status === "Open" &&
                      item.ownerKind === "Reviewer" ? (
                        <button
                          type="button"
                          onClick={() => completeAction.mutate(item)}
                          disabled={completeAction.isLoading}
                          className="mt-2 rounded-md px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
                        >
                          {checkInTerms.markActionDone}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}

            {data.rescheduleHistory.length > 0 ? (
              <Panel
                title="Reschedule history"
                icon={<History className="size-4" />}
                compact
              >
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {data.rescheduleHistory.map((entry, index) => (
                    <li key={index}>
                      {formatCheckInWhen(
                        entry.previousDate,
                        entry.previousTime
                      )}{" "}
                      →{" "}
                      <span className="text-foreground">
                        {formatCheckInWhen(entry.newDate, entry.newTime)}
                      </span>{" "}
                      · {entry.actorName} · {formatDate(entry.occurredAt)}
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}
          </aside>
        </div>
      </div>

      {/* Dialogs */}
      <RescheduleDialog
        open={action === "reschedule"}
        version={data.version}
        isSaving={reschedule.isLoading}
        errors={actionErrors}
        onSubmit={(request) => reschedule.mutate(request)}
        onClose={() => setAction(null)}
      />
      <CancelDialog
        open={action === "cancel"}
        version={data.version}
        isSaving={cancel.isLoading}
        errors={actionErrors}
        onSubmit={(request) => cancel.mutate(request)}
        onClose={() => setAction(null)}
      />
      <CompleteCheckInDialog
        open={action === "complete"}
        checkIn={data}
        isSaving={complete.isLoading}
        errors={actionErrors}
        onSubmit={(request) => complete.mutate(request)}
        onClose={() => setAction(null)}
      />
    </PageContainer>
  );
}

function Panel({
  title,
  icon,
  meta,
  compact = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  meta?: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border bg-card",
        compact ? "p-4" : "p-5 sm:p-6"
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </h2>
        {meta ? (
          <span className="text-xs text-muted-foreground">{meta}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function RescheduleDialog({
  open,
  version,
  isSaving,
  errors,
  onSubmit,
  onClose,
}: {
  open: boolean;
  version: number;
  isSaving: boolean;
  errors: string[];
  onSubmit: (request: RescheduleCheckInRequest) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!next ? onClose() : undefined)}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{checkInTerms.rescheduleTitle}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="reschedule-date">{checkInTerms.newDateLabel}</Label>
            <Input
              id="reschedule-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reschedule-time">{checkInTerms.timeLabel}</Label>
            <Input
              id="reschedule-time"
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className="w-32"
            />
          </div>
        </div>
        {errors.length > 0 ? (
          <p className="text-sm text-destructive">{errors.join(" ")}</p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSaving}
          >
            {checkInTerms.keep}
          </Button>
          <Button
            type="button"
            disabled={isSaving || date.length === 0}
            onClick={() =>
              onSubmit({
                expectedVersion: version,
                newDate: new Date(`${date}T00:00:00`).toISOString(),
                newTime: time.trim() ? time.trim() : null,
              })
            }
          >
            {isSaving ? <Spinner className="size-4" /> : null}
            {isSaving ? checkInTerms.rescheduling : checkInTerms.rescheduleCta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({
  open,
  version,
  isSaving,
  errors,
  onSubmit,
  onClose,
}: {
  open: boolean;
  version: number;
  isSaving: boolean;
  errors: string[];
  onSubmit: (request: CancelCheckInRequest) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!next ? onClose() : undefined)}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{checkInTerms.cancelTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason">
            {checkInTerms.cancelReasonLabel}
          </Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={checkInTerms.cancelReasonPlaceholder}
            maxLength={500}
            rows={3}
          />
        </div>
        {errors.length > 0 ? (
          <p className="text-sm text-destructive">{errors.join(" ")}</p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSaving}
          >
            {checkInTerms.keep}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isSaving || reason.trim().length === 0}
            onClick={() =>
              onSubmit({ expectedVersion: version, reason: reason.trim() })
            }
          >
            {isSaving ? <Spinner className="size-4" /> : null}
            {isSaving ? checkInTerms.cancelling : checkInTerms.cancelCta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function errorMessages(error: Error): string[] {
  if (error instanceof ApiError && error.errors.length > 0) return error.errors;
  return [checkInTerms.genericError];
}
