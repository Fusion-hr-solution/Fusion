"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Lock, MessageCircleWarning } from "lucide-react";
import {
  ApiError,
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
  type EmployeeCheckInsDto,
  type EmployeeObjectiveDto,
  type EmployeeObjectivePlanWorkspaceDto,
  type ObjectiveProgressStateDto,
  type ObjectiveProgressUpdateDto,
  type RaiseDiscussionSignalRequest,
  type RecordObjectiveProgressRequest,
  type RecordObjectiveProgressResponseDto,
  type DiscussionSignalMutationResult,
} from "@repo/api";
import { useApiMutation, useApiQuery } from "@repo/api/query";
import { toast } from "sonner";
import { formatDate, measurementMethodLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RecordProgressDialog, type RecordProgressTarget } from "./record-progress-dialog";
import { ProgressHistoryTimeline } from "./progress-history-timeline";
import { ObjectiveStateBadge, ProgressMeter, toneForObjective } from "./progress-visuals";
import { progressTerms } from "./progress-terms";
import { useEvidence } from "./use-evidence";
import { EmployeeCheckIns } from "@/components/check-ins/employee-check-ins";
import { NeedsDiscussionDialog } from "@/components/check-ins/needs-discussion-dialog";
import { checkInTerms } from "@/components/check-ins/check-in-terms";

/**
 * The living progress record: after planning lock, the employee's approved plan is shown as a
 * weighted-progress hero plus one card per locked objective — baseline context, current derived
 * state, and its append-only history — each with a record-progress action. The locked baseline is
 * never editable here; only new traced updates are added.
 */
export function ProgressWorkspace({
  workspace,
  onRecorded,
}: {
  workspace: EmployeeObjectivePlanWorkspaceDto;
  onRecorded: () => Promise<unknown>;
}) {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const { download } = useEvidence();
  const [target, setTarget] = useState<RecordProgressTarget | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [discussTarget, setDiscussTarget] = useState<EmployeeObjectiveDto | null>(null);
  const [discussError, setDiscussError] = useState<string | null>(null);

  const plan = workspace.plan;
  const objectives = plan?.objectives ?? [];
  const progress = workspace.progress;
  const planVersion = plan?.version ?? 0;
  const cycleId = workspace.cycleId;

  // Shared cache with the employee check-in surface below — one fetch feeds both the flagged badges
  // and the check-in list, so raising a flag reflects everywhere at once.
  const checkInsKey = performanceQueryKeys.myCheckIns(cycleId);
  const { data: checkIns } = useApiQuery<EmployeeCheckInsDto>(checkInsKey, (signal) =>
    apiClient.get<EmployeeCheckInsDto>(performancePaths.myCheckIns(cycleId), { signal }),
  );
  const flaggedObjectiveIds = useMemo(
    () => new Set((checkIns?.openDiscussionSignals ?? []).map((signal) => signal.objectiveId)),
    [checkIns],
  );

  const raiseSignal = useApiMutation<DiscussionSignalMutationResult, RaiseDiscussionSignalRequest>(
    (request) =>
      apiClient.post<DiscussionSignalMutationResult>(
        performancePaths.raiseDiscussionSignal(cycleId),
        request,
      ),
    {
      invalidateQueries: [{ queryKey: checkInsKey }],
      onSuccess: () => {
        toast.success(checkInTerms.raised);
        setDiscussTarget(null);
        setDiscussError(null);
      },
      onError: (mutationError) => {
        setDiscussError(
          mutationError instanceof ApiError && mutationError.errors.length > 0
            ? mutationError.errors[0]!
            : checkInTerms.genericError,
        );
      },
    },
  );

  const historyByObjective = useMemo(() => {
    const map = new Map<string, ObjectiveProgressUpdateDto[]>();
    for (const update of workspace.progressHistory) {
      const list = map.get(update.objectiveId) ?? [];
      list.push(update);
      map.set(update.objectiveId, list);
    }
    return map;
  }, [workspace.progressHistory]);

  const stateByObjective = useMemo(() => {
    const map = new Map<string, ObjectiveProgressStateDto>();
    for (const state of progress?.objectives ?? []) {
      map.set(state.objectiveId, state);
    }
    return map;
  }, [progress]);

  const record = useApiMutation<RecordObjectiveProgressResponseDto, { objectiveId: string; request: RecordObjectiveProgressRequest }>(
    ({ objectiveId, request }) =>
      apiClient.post<RecordObjectiveProgressResponseDto>(
        performancePaths.employeeObjectiveProgress(cycleId, objectiveId),
        request,
        { headers: { "If-Match": `"${planVersion}"` } },
      ),
    {
      onSuccess: async (result) => {
        if (result.outcome === "conflict") {
          await onRecorded();
          setErrors([progressTerms.conflictRetry]);
          return;
        }
        if (result.recorded) {
          toast.success(progressTerms.recordedToast);
          setTarget(null);
          setErrors([]);
        } else {
          setErrors(result.blockingReasons.map((reason) => reason.message));
        }
        await onRecorded();
      },
      onError: async (mutationError) => {
        const messages =
          mutationError instanceof ApiError && mutationError.errors.length > 0
            ? mutationError.errors
            : ["Something went wrong. Try again."];
        setErrors(messages);
        await onRecorded();
      },
    },
  );

  return (
    <div className="space-y-4">
      {progress ? <ProgressHero progress={progress} lockedAt={workspace.planningLockedAt} /> : null}

      <div className="space-y-3">
        {objectives.map((objective) => {
          const state = stateByObjective.get(objective.id);
          const history = historyByObjective.get(objective.id) ?? [];
          return (
            <ObjectiveProgressCard
              key={objective.id}
              objective={objective}
              state={state}
              history={history}
              isFlagged={flaggedObjectiveIds.has(objective.id)}
              onRecord={() => {
                if (!state) return;
                setErrors([]);
                setTarget({ objective, state });
              }}
              onDiscuss={() => {
                setDiscussError(null);
                setDiscussTarget(objective);
              }}
              onDownloadEvidence={(id, name) => void download(id, name)}
            />
          );
        })}
      </div>

      <div className="border-t pt-4">
        <EmployeeCheckIns cycleId={cycleId} />
      </div>

      <RecordProgressDialog
        target={target}
        isSaving={record.isLoading}
        errors={errors}
        onSubmit={(request) =>
          target
            ? record.mutate({ objectiveId: target.objective.id, request })
            : undefined
        }
        onClose={() => {
          setTarget(null);
          setErrors([]);
        }}
      />

      <NeedsDiscussionDialog
        open={discussTarget !== null}
        objectiveTitle={discussTarget?.title ?? ""}
        objectiveId={discussTarget?.id ?? ""}
        isSaving={raiseSignal.isLoading}
        error={discussError}
        onSubmit={(request) => raiseSignal.mutate(request)}
        onClose={() => {
          setDiscussTarget(null);
          setDiscussError(null);
        }}
      />
    </div>
  );
}

function ProgressHero({
  progress,
  lockedAt,
}: {
  progress: NonNullable<EmployeeObjectivePlanWorkspaceDto["progress"]>;
  lockedAt: string | null;
}) {
  const allCurrent = progress.staleObjectiveCount === 0;
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{progressTerms.planProgress}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-5xl font-semibold tabular-nums leading-none text-foreground">
              {progress.weightedProgressPercent}
              <span className="text-2xl text-muted-foreground">%</span>
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <span className="text-sm font-medium text-foreground">
            {progressTerms.ofObjectivesComplete(progress.completedObjectiveCount, progress.objectiveCount)}
          </span>
          <span
            className={cn(
              "text-xs font-medium",
              allCurrent ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
            )}
          >
            {allCurrent ? progressTerms.everythingCurrent : progressTerms.staleCount(progress.staleObjectiveCount)}
          </span>
        </div>
      </div>
      <ProgressMeter
        percent={progress.weightedProgressPercent}
        tone={progress.weightedProgressPercent === 100 ? "success" : "primary"}
        height="lg"
        className="mt-4"
      />
      {lockedAt ? (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" />
          Locked baseline · {formatDate(lockedAt)}
        </p>
      ) : null}
    </section>
  );
}

function ObjectiveProgressCard({
  objective,
  state,
  history,
  isFlagged,
  onRecord,
  onDiscuss,
  onDownloadEvidence,
}: {
  objective: EmployeeObjectiveDto;
  state: ObjectiveProgressStateDto | undefined;
  history: ObjectiveProgressUpdateDto[];
  isFlagged: boolean;
  onRecord: () => void;
  onDiscuss: () => void;
  onDownloadEvidence: (attachmentId: string, fileName: string) => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const current = state?.currentPercent ?? 0;
  const recordLabel =
    (state?.updateCount ?? 0) === 0 ? progressTerms.firstUpdate : progressTerms.updateProgress;

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">{objective.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              {progressTerms.weight}: <span className="tabular-nums text-foreground">{objective.weight ?? 0}%</span>
            </span>
            {objective.measurementMethod ? (
              <span>{measurementMethodLabel(objective.measurementMethod)}</span>
            ) : null}
            {objective.deadline ? (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3.5" />
                {formatDate(objective.deadline)}
              </span>
            ) : null}
          </div>
        </div>
        {state ? <ObjectiveStateBadge state={state.state} isStale={state.isStale} /> : null}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <ProgressMeter
          percent={current}
          tone={state ? toneForObjective(state) : "muted"}
          className="flex-1"
        />
        <span className="w-12 text-right text-sm font-semibold tabular-nums text-foreground">
          {current}%
        </span>
      </div>

      {state?.lastActualValue ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {progressTerms.actualLabel}: <span className="text-foreground">{state.lastActualValue}</span>
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={onRecord}>
            {recordLabel}
          </Button>
          {isFlagged ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              <MessageCircleWarning className="size-3.5" />
              {checkInTerms.flaggedBadge}
            </span>
          ) : (
            <Button type="button" size="sm" variant="ghost" onClick={onDiscuss}>
              <MessageCircleWarning className="size-4" />
              {checkInTerms.needsDiscussionShort}
            </Button>
          )}
          {history.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowHistory((open) => !open)}
            >
              {showHistory ? "Hide history" : progressTerms.historyTitle}
              <span className="ml-1 text-muted-foreground">({history.length})</span>
            </Button>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">
          {state && state.lastUpdateAt
            ? progressTerms.lastUpdated(formatDate(state.lastUpdateAt))
            : progressTerms.neverUpdated}
        </span>
      </div>

      {showHistory && history.length > 0 ? (
        <div className="mt-4 border-t pt-4">
          <ProgressHistoryTimeline updates={history} onDownloadEvidence={onDownloadEvidence} />
        </div>
      ) : null}
    </section>
  );
}
