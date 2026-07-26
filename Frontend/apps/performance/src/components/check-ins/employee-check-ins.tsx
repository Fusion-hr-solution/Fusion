"use client";

import { useMemo, useState } from "react";
import { CalendarClock, ClipboardCheck, MessageSquare } from "lucide-react";
import {
  ApiError,
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
  type AddCheckInEmployeeResponseRequest,
  type CheckInDetailDto,
  type CheckInMutationResult,
  type CheckInSummaryDto,
  type CompleteFollowUpActionRequest,
  type EmployeeCheckInsDto,
  type FollowUpActionDto,
  type FollowUpActionMutationResult,
} from "@repo/api";
import { useApiMutation, useApiQuery } from "@repo/api/query";
import { PageError, PageListSkeleton } from "@repo/ds/shell";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateTime } from "@/lib/labels";
import { checkInTerms } from "./check-in-terms";
import {
  ActionStatusBadge,
  CheckInStatusBadge,
  formatCheckInWhen,
} from "./check-in-visuals";

/**
 * The employee's own check-in and follow-up surface, shown under their locked plan in My objectives.
 * They see what's planned, what was discussed (with a single, one-time response), and any follow-ups
 * they own. Everything the manager authored is read-only here.
 */
export function EmployeeCheckIns({ cycleId }: { cycleId: string }) {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const listKey = performanceQueryKeys.myCheckIns(cycleId);

  const { data, error, isLoading, refetch } = useApiQuery<EmployeeCheckInsDto>(
    listKey,
    (signal) =>
      apiClient.get<EmployeeCheckInsDto>(performancePaths.myCheckIns(cycleId), {
        signal,
      }),
  );

  const invalidate = [{ queryKey: listKey }];

  const respond = useApiMutation<
    CheckInMutationResult,
    { checkInId: string; request: AddCheckInEmployeeResponseRequest }
  >(
    ({ checkInId, request }) =>
      apiClient.post<CheckInMutationResult>(
        performancePaths.addCheckInResponse(checkInId),
        request,
      ),
    {
      invalidateQueries: invalidate,
      onSuccess: () => void toast.success(checkInTerms.responseRecorded),
      onError: (mutationError) => void toast.error(firstError(mutationError)),
    },
  );

  const completeAction = useApiMutation<FollowUpActionMutationResult, FollowUpActionDto>(
    (action) =>
      apiClient.post<FollowUpActionMutationResult>(
        performancePaths.completeFollowUpAction(action.id),
        { expectedVersion: action.version, note: null } satisfies CompleteFollowUpActionRequest,
      ),
    {
      invalidateQueries: invalidate,
      onSuccess: () => void toast.success("Follow-up done"),
      onError: (mutationError) => void toast.error(firstError(mutationError)),
    },
  );

  if (isLoading) {
    return <PageListSkeleton label="Loading check-ins" />;
  }
  if (error || !data) {
    return (
      <PageError title="Could not load check-ins" description="Try again." onRetry={refetch} />
    );
  }

  const hasAnything =
    data.upcoming.length > 0 ||
    data.completed.length > 0 ||
    data.assignedActions.length > 0;

  if (!hasAnything) {
    return (
      <section className="rounded-xl border border-dashed p-5 text-center">
        <p className="text-sm font-medium text-foreground">
          {checkInTerms.emptyEmployeeUpcoming}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {checkInTerms.emptyEmployeeUpcomingHint}
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
        <CalendarClock className="size-4 text-primary" />
        {checkInTerms.panelTitle}
      </h2>

      {/* Assigned follow-ups the employee owns. */}
      {data.assignedActions.length > 0 ? (
        <section className="space-y-2">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <ClipboardCheck className="size-3.5" />
            {checkInTerms.actionsTitle}
          </p>
          <ul className="space-y-1.5">
            {data.assignedActions.map((action) => (
              <li
                key={action.id}
                className="flex items-start justify-between gap-3 rounded-lg border bg-card px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{action.description}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {checkInTerms.actionDueLabel} {formatDate(action.dueDate)}
                    </span>
                    <ActionStatusBadge status={action.status} isOverdue={action.isOverdue} />
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => completeAction.mutate(action)}
                  disabled={completeAction.isLoading}
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
                >
                  {checkInTerms.markActionDone}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Upcoming planned check-ins. */}
      {data.upcoming.length > 0 ? (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {checkInTerms.upcomingTitle}
          </p>
          <div className="space-y-2">
            {data.upcoming.map((item) => (
              <UpcomingRow key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Completed check-ins with outcome + one-time response. */}
      {data.completed.length > 0 ? (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {checkInTerms.historyTitle}
          </p>
          <div className="space-y-2">
            {data.completed.map((item) => (
              <CompletedCard
                key={item.id}
                item={item}
                isSaving={respond.isLoading}
                onRespond={(text) =>
                  respond.mutate({ checkInId: item.id, request: { text } })
                }
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function UpcomingRow({ item }: { item: CheckInSummaryDto }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{item.reason}</span>
          <CheckInStatusBadge status={item.status} isOverdue={item.isOverdue} />
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatCheckInWhen(item.plannedDate, item.plannedTime)} · {item.createdByReviewerName}
        </p>
      </div>
    </div>
  );
}

function CompletedCard({
  item,
  isSaving,
  onRespond,
}: {
  item: CheckInDetailDto;
  isSaving: boolean;
  onRespond: (text: string) => void;
}) {
  const [text, setText] = useState("");

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{item.reason}</span>
        <span className="text-xs text-muted-foreground">
          {item.completedAt ? formatDate(item.completedAt) : null}
        </span>
      </div>

      {item.completionSummary ? (
        <p className="whitespace-pre-wrap text-sm text-foreground">{item.completionSummary}</p>
      ) : null}

      {item.actions.length > 0 ? (
        <ul className="space-y-1 border-t pt-2">
          {item.actions.map((action) => (
            <li key={action.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-foreground">{action.description}</span>
              <ActionStatusBadge status={action.status} isOverdue={action.isOverdue} />
            </li>
          ))}
        </ul>
      ) : null}

      {/* Single, immutable response. */}
      <div className="border-t pt-3">
        {item.response ? (
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <MessageSquare className="size-3.5" />
              {checkInTerms.responseTitle}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {item.response.text}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDateTime(item.response.createdAtUtc)}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={checkInTerms.responsePlaceholder}
              maxLength={2000}
              rows={2}
            />
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                disabled={isSaving || text.trim().length === 0}
                onClick={() => onRespond(text.trim())}
              >
                {isSaving ? checkInTerms.responseSending : checkInTerms.responseCta}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function firstError(error: Error): string {
  if (error instanceof ApiError && error.errors.length > 0) return error.errors[0]!;
  return checkInTerms.genericError;
}
