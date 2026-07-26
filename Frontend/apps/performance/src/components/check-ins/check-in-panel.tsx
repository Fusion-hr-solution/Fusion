"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarPlus,
  ChevronRight,
  MessageCircleWarning,
} from "lucide-react";
import {
  ApiError,
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
  type CheckInMutationResult,
  type CheckInParticipantPanelDto,
  type CheckInSummaryDto,
  type DiscussionSignalMutationResult,
  type FollowUpActionDto,
  type FollowUpActionMutationResult,
  type PlanCheckInRequest,
} from "@repo/api";
import { useApiMutation, useApiQuery } from "@repo/api/query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageError, PageListSkeleton } from "@repo/ds/shell";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/labels";
import { checkInTerms, ownerLabel } from "./check-in-terms";
import {
  ActionStatusBadge,
  CheckInStatusBadge,
  formatCheckInWhen,
} from "./check-in-visuals";
import { PlanCheckInDialog, type LinkableObjective } from "./plan-check-in-dialog";

/**
 * The manager's check-in cockpit for one participant, embedded under their progress in Team progress.
 * Attention-first: what the person flagged and any overdue check-in sit at the top, then upcoming,
 * open follow-ups, and finally the completed history. Each check-in opens its focused conversation.
 */
export function CheckInPanel({
  cycleId,
  slug,
  employeeId,
  objectives,
}: {
  cycleId: string;
  slug: string;
  employeeId: string;
  objectives: LinkableObjective[];
}) {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const [planOpen, setPlanOpen] = useState(false);
  const [planErrors, setPlanErrors] = useState<string[]>([]);

  const panelKey = performanceQueryKeys.checkInParticipantPanel(cycleId, employeeId);
  const { data, error, isLoading, refetch } =
    useApiQuery<CheckInParticipantPanelDto>(panelKey, (signal) =>
      apiClient.get<CheckInParticipantPanelDto>(
        performancePaths.checkInParticipantPanel(cycleId, employeeId),
        { signal },
      ),
    );

  const invalidate = [{ queryKey: panelKey }];

  const plan = useApiMutation<CheckInMutationResult, PlanCheckInRequest>(
    (request) =>
      apiClient.post<CheckInMutationResult>(
        performancePaths.planCheckIn(cycleId),
        request,
      ),
    {
      invalidateQueries: invalidate,
      onSuccess: () => {
        toast.success("Check-in planned");
        setPlanOpen(false);
        setPlanErrors([]);
      },
      onError: (mutationError) => setPlanErrors(errorMessages(mutationError)),
    },
  );

  const closeSignal = useApiMutation<DiscussionSignalMutationResult, { signalId: string }>(
    ({ signalId }) =>
      apiClient.post<DiscussionSignalMutationResult>(
        performancePaths.closeDiscussionSignal(signalId),
        { reason: "Not needed" },
      ),
    {
      invalidateQueries: invalidate,
      onSuccess: () => void toast.success("Flag dismissed"),
      onError: (mutationError) => void toast.error(firstError(mutationError)),
    },
  );

  const completeAction = useApiMutation<FollowUpActionMutationResult, FollowUpActionDto>(
    (action) =>
      apiClient.post<FollowUpActionMutationResult>(
        performancePaths.completeFollowUpAction(action.id),
        { expectedVersion: action.version, note: null },
      ),
    {
      invalidateQueries: invalidate,
      onSuccess: () => void toast.success("Follow-up done"),
      onError: (mutationError) => void toast.error(firstError(mutationError)),
    },
  );

  const cancelAction = useApiMutation<FollowUpActionMutationResult, FollowUpActionDto>(
    (action) =>
      apiClient.post<FollowUpActionMutationResult>(
        performancePaths.cancelFollowUpAction(action.id),
        { expectedVersion: action.version, reason: "No longer needed" },
      ),
    {
      invalidateQueries: invalidate,
      onSuccess: () => void toast.success("Follow-up cancelled"),
      onError: (mutationError) => void toast.error(firstError(mutationError)),
    },
  );

  if (isLoading) {
    return <PageListSkeleton label="Loading check-ins" />;
  }
  if (error || !data) {
    return (
      <PageError
        title="Could not load check-ins"
        description="Try again."
        onRetry={refetch}
      />
    );
  }

  const nextByObjective = data.overdue.length + data.upcoming.length;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          {checkInTerms.panelTitle}
          {nextByObjective > 0 ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
              {nextByObjective}
            </span>
          ) : null}
        </h3>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setPlanErrors([]);
            setPlanOpen(true);
          }}
        >
          <CalendarPlus className="size-4" />
          {checkInTerms.planShort}
        </Button>
      </div>

      {/* What the employee flagged — the conversation they asked for. */}
      {data.openDiscussionSignals.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <MessageCircleWarning className="size-3.5" />
            {checkInTerms.signalsTitle}
          </p>
          <ul className="space-y-1.5">
            {data.openDiscussionSignals.map((signal) => (
              <li
                key={signal.id}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="font-medium text-foreground">
                    {signal.objectiveTitle}
                  </span>
                  {signal.note ? (
                    <span className="block text-xs text-muted-foreground">
                      {signal.note}
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => closeSignal.mutate({ signalId: signal.id })}
                  disabled={closeSignal.isLoading}
                  className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  {checkInTerms.closeSignal}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Overdue + upcoming check-ins. */}
      {data.overdue.length > 0 || data.upcoming.length > 0 ? (
        <div className="space-y-2">
          {data.overdue.map((item) => (
            <CheckInRow key={item.id} item={item} slug={slug} />
          ))}
          {data.upcoming.map((item) => (
            <CheckInRow key={item.id} item={item} slug={slug} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-4 text-center">
          <p className="text-sm font-medium text-foreground">
            {checkInTerms.noUpcoming}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {checkInTerms.noUpcomingHint}
          </p>
        </div>
      )}

      {/* Open follow-up actions. */}
      {data.unresolvedActions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {checkInTerms.actionsTitle}
          </p>
          <ul className="space-y-1.5">
            {data.unresolvedActions.map((action) => (
              <li
                key={action.id}
                className="flex items-start justify-between gap-3 rounded-lg border bg-card px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{action.description}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{ownerLabel(action.ownerKind)}</span>
                    <span aria-hidden>·</span>
                    <span>{checkInTerms.actionDueLabel} {formatDate(action.dueDate)}</span>
                    <ActionStatusBadge status={action.status} isOverdue={action.isOverdue} />
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {action.ownerKind === "Reviewer" ? (
                    <button
                      type="button"
                      onClick={() => completeAction.mutate(action)}
                      disabled={completeAction.isLoading}
                      className="rounded-md px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
                    >
                      {checkInTerms.markActionDone}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => cancelAction.mutate(action)}
                    disabled={cancelAction.isLoading}
                    className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {checkInTerms.cancel.replace(" check-in", "")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Completed history. */}
      {data.completedHistory.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {checkInTerms.historyTitle}
          </p>
          <div className="space-y-2">
            {data.completedHistory.map((item) => (
              <CheckInRow key={item.id} item={item} slug={slug} muted />
            ))}
          </div>
        </div>
      ) : null}

      <PlanCheckInDialog
        open={planOpen}
        employeeId={employeeId}
        objectives={objectives}
        openSignals={data.openDiscussionSignals}
        isSaving={plan.isLoading}
        errors={planErrors}
        onSubmit={(request) => plan.mutate(request)}
        onClose={() => {
          setPlanOpen(false);
          setPlanErrors([]);
        }}
      />
    </section>
  );
}

function CheckInRow({
  item,
  slug,
  muted = false,
}: {
  item: CheckInSummaryDto;
  slug: string;
  muted?: boolean;
}) {
  return (
    <Link
      href={`/team-progress/${slug}/check-ins/${item.id}`}
      className={cn(
        "group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-[border-color,box-shadow] hover:border-primary/35 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        muted && "bg-muted/20",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {item.reason}
          </span>
          <CheckInStatusBadge status={item.status} isOverdue={item.isOverdue} />
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {item.status === "Completed" && item.completedAt
              ? formatDate(item.completedAt)
              : formatCheckInWhen(item.plannedDate, item.plannedTime)}
          </span>
          {item.linkedObjectiveCount > 0 ? (
            <>
              <span aria-hidden>·</span>
              <span>{checkInTerms.linkedObjectives(item.linkedObjectiveCount)}</span>
            </>
          ) : null}
          {item.hasResponse ? (
            <>
              <span aria-hidden>·</span>
              <span>Response added</span>
            </>
          ) : null}
        </p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function errorMessages(error: Error): string[] {
  if (error instanceof ApiError && error.errors.length > 0) return error.errors;
  return [checkInTerms.genericError];
}

function firstError(error: Error): string {
  return errorMessages(error)[0] ?? checkInTerms.genericError;
}
