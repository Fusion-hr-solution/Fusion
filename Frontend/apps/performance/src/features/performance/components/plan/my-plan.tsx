"use client";

import { useState } from "react";
import { Lock, Plus } from "lucide-react";
import { toast } from "sonner";
import type { AddPlanObjectiveRequest, CycleSummaryDto, EmployeePlanDto, PlanObjectiveDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { AsyncButton, PageError, PageSkeleton, StatusBadge } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { useAlignmentTargets, useMyPlan, usePlanMutations } from "../../api/use-performance";
import { formatDate } from "../../lib";
import { LiveWeightSummary } from "./live-weight-summary";
import { PlanGoalComposer } from "./goal-composer";
import { PlanObjectiveRow } from "./plan-objective-row";
import { pct } from "./plan-lib";
import { ObjectiveProgressPanel } from "../progress/objective-progress-panel";

export function MyPlan({ cycle }: { cycle: CycleSummaryDto }) {
  const cycleId = cycle.id;
  const state = useMyPlan(cycleId);
  const targetsQuery = useAlignmentTargets(cycleId, state.data?.hasPlan ?? false);
  const mutations = usePlanMutations(cycleId);

  const [composer, setComposer] = useState<{ objective?: PlanObjectiveDto } | null>(null);
  const [progressFor, setProgressFor] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  if (state.isLoading) return <PageSkeleton rows={4} label="Loading your plan" />;
  if (state.error || !state.data) {
    return <PageError title="Plan unavailable" description={state.error?.message} onRetry={state.refetch} />;
  }

  const { participatesInCycle, plan } = state.data;

  if (!participatesInCycle) {
    return (
      <p className="max-w-md text-sm text-muted-foreground">
        You are not part of this Cycle. When your organization adds you, your plan opens here.
      </p>
    );
  }

  // No plan yet — an integrated first entry that leads straight into authoring.
  if (!plan) {
    return (
      <div className="max-w-lg space-y-5">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Set the objectives you will be measured on this Cycle. Build a plan that totals 100% from
          objectives aligned to direction and standalone role objectives.
        </p>
        <dl className="flex flex-wrap gap-x-10 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Planning open until</dt>
            <dd className="mt-0.5 font-medium text-foreground">{formatDate(cycle.planningDeadline)}</dd>
          </div>
        </dl>
        <AsyncButton
          size="lg"
          pending={starting}
          onClick={async () => {
            setStarting(true);
            try {
              await mutations.create.mutateAsync();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Could not start your plan.");
            } finally {
              setStarting(false);
            }
          }}
        >
          Start planning
        </AsyncButton>
      </div>
    );
  }

  const latestReturn = [...plan.history].reverse().find((h) => h.kind === "Returned");
  const returned = plan.state === "Draft" && Boolean(latestReturn);

  return (
    <div className="space-y-6">
      <LifecycleStrip plan={plan} returned={returned} returnedFeedback={latestReturn?.feedback ?? null} />

      {/* A locked plan tracks progress against the frozen baseline. */}
      {plan.isLocked ? <PlanProgressSummary plan={plan} /> : null}

      {/* Objective ledger. */}
      <section className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <span className="type-eyebrow text-muted-foreground">Objectives</span>
          <span className="text-xs tabular-nums text-muted-foreground">{plan.objectives.length}</span>
        </div>

        {plan.objectives.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No objectives yet. Add the first one below.
          </div>
        ) : (
          <div className="divide-y divide-border px-5">
            {plan.objectives.map((objective, index) => (
              <PlanObjectiveRow
                key={objective.id}
                index={index}
                objective={objective}
                editable={plan.canAuthor}
                showProgress={plan.isLocked}
                onEdit={() => setComposer({ objective })}
                onOpenProgress={() => setProgressFor(objective.id)}
                onRemove={async () => {
                  try {
                    await mutations.removeObjective.mutateAsync(objective.id);
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not remove the objective.");
                  }
                }}
              />
            ))}
          </div>
        )}

        {plan.canAuthor ? (
          <div className="border-t border-border px-5 py-3">
            <Button variant="ghost" size="sm" onClick={() => setComposer({})}>
              <Plus className="size-4" data-icon="inline-start" /> Add objective
            </Button>
          </div>
        ) : null}
      </section>

      {/* Weight summary + submit — author only. */}
      {plan.canAuthor ? (
        <LiveWeightSummary
          readiness={plan.readiness}
          canSubmit={plan.canSubmit}
          submitting={mutations.submit.isLoading}
          submitLabel={returned ? "Resubmit plan" : "Submit plan"}
          onSubmit={async () => {
            try {
              await mutations.submit.mutateAsync();
              toast.success(returned ? "Plan resubmitted for review." : "Plan submitted for review.");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Could not submit your plan.");
            }
          }}
        />
      ) : null}

      {composer ? (
        <PlanGoalComposer
          open
          onOpenChange={(open) => {
            if (!open) setComposer(null);
          }}
          targets={targetsQuery.data ?? []}
          standaloneAllowed={plan.readiness.standaloneAllowed}
          objective={composer.objective}
          otherWeightTotal={plan.readiness.weightTotal - (composer.objective?.planWeight ?? 0)}
          onCreate={async (request: AddPlanObjectiveRequest) => {
            await mutations.addObjective.mutateAsync(request);
            toast.success("Objective added.");
          }}
          onUpdate={async (request: AddPlanObjectiveRequest) => {
            if (!composer.objective) return;
            await mutations.updateObjective.mutateAsync({ objectiveId: composer.objective.id, request });
            toast.success("Objective updated.");
          }}
        />
      ) : null}

      <ObjectiveProgressPanel
        cycleId={cycleId}
        objectiveId={progressFor}
        open={progressFor !== null}
        onOpenChange={(open) => {
          if (!open) setProgressFor(null);
        }}
      />
    </div>
  );
}

/**
 * The plan's current lifecycle state, told once and truthfully. A returned plan is the
 * signature state: the manager's required change leads, not a generic "Draft". Submitted
 * and approved states name the real reviewer instead of "your manager".
 */
function LifecycleStrip({
  plan,
  returned,
  returnedFeedback,
}: {
  plan: EmployeePlanDto;
  returned: boolean;
  returnedFeedback: string | null;
}) {
  const reviewer = plan.responsibleManager?.name ?? "your manager";

  if (returned) {
    return (
      <section className="rounded-2xl border border-warning/40 bg-warning/[0.06] p-5">
        <div className="flex items-center gap-2">
          <StatusBadge tone="warning">Returned for changes</StatusBadge>
        </div>
        {returnedFeedback ? (
          <p className="mt-3 text-sm leading-relaxed text-foreground">“{returnedFeedback}”</p>
        ) : null}
        <p className="mt-2 text-sm text-muted-foreground">
          {reviewer} asked for changes. Revise the objectives below and resubmit.
        </p>
      </section>
    );
  }

  if (plan.state === "Submitted") {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 px-5 py-4">
        <div>
          <p className="text-sm font-medium text-foreground">Awaiting {reviewer}&apos;s review</p>
          {plan.submittedAt ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Submitted {formatDate(plan.submittedAt.slice(0, 10))} · read-only until reviewed
            </p>
          ) : null}
        </div>
        <StatusBadge tone="warning" dot>
          Submitted
        </StatusBadge>
      </section>
    );
  }

  if (plan.isLocked) {
    const approvedOn = plan.approvedAt ? formatDate(plan.approvedAt.slice(0, 10)) : null;
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="size-3.5 text-success" aria-hidden />
        <span className="font-medium text-success">Approved &amp; locked</span>
        <span aria-hidden className="text-border">·</span>
        {plan.approvalKind === "Exceptional"
          ? "by performance administration"
          : `by ${reviewer}`}
        {approvedOn ? ` · ${approvedOn}` : ""}
      </p>
    );
  }

  // Fresh draft — quiet reviewer + planning context.
  return (
    <p className="text-sm text-muted-foreground">
      Reviewer: <span className="font-medium text-foreground">{reviewer}</span>
    </p>
  );
}

/**
 * Plan progress for a locked plan — one weighted meter, self-explanatory through the ledger
 * beneath it (each objective already shows its own progress and weight). No rainbow segments.
 */
function PlanProgressSummary({ plan }: { plan: EmployeePlanDto }) {
  const complete = plan.planProgress >= 100;
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="type-eyebrow text-muted-foreground">Plan progress</p>
          <p
            className={cn(
              "mt-1 type-metric text-foreground",
              complete && "text-success"
            )}
          >
            {pct(plan.planProgress)}%
          </p>
        </div>
        <p className="pb-1 text-xs text-muted-foreground">
          Weighted across {plan.objectives.length} objective{plan.objectives.length === 1 ? "" : "s"}
        </p>
      </div>
      <div
        className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`Plan progress ${pct(plan.planProgress)} percent`}
      >
        <span
          className={cn("block h-full rounded-full", complete ? "bg-success" : "bg-primary")}
          style={{ width: `${Math.min(plan.planProgress, 100)}%` }}
        />
      </div>
    </section>
  );
}
