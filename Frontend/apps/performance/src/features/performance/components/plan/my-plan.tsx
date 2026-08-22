"use client";

import { useState } from "react";
import { CornerDownRight, Lock, Plus, Target } from "lucide-react";
import { toast } from "sonner";
import type { AddPlanObjectiveRequest, CycleSummaryDto, EmployeePlanDto, PlanObjectiveDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { AsyncButton, PageError, PageSkeleton, StatusBadge } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { useAlignmentTargets, useMyPlan, usePlanMutations } from "../../api/use-performance";
import { LiveWeightSummary } from "./live-weight-summary";
import { PlanGoalComposer } from "./goal-composer";
import { PlanObjectiveRow } from "./plan-objective-row";
import { PLAN_STATE_LABEL, PLAN_STATE_TONE, pct } from "./plan-lib";
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
      <EmptyPanel
        icon={Target}
        title="You are not part of this cycle"
        body="When your organization adds you to a performance cycle, your plan opens here."
      />
    );
  }

  // No plan yet — an empty state that leads straight into authoring.
  if (!plan) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-dashed p-10 text-center">
        <Target className="mx-auto size-6 text-muted-foreground" aria-hidden />
        <p className="mt-3 text-base font-medium">Build your plan</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Set the objectives you will be measured on this cycle and align them to your organization&apos;s direction.
        </p>
        <AsyncButton
          className="mt-5"
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
          Start my plan
        </AsyncButton>
      </div>
    );
  }

  const latestReturn = [...plan.history].reverse().find((h) => h.kind === "Returned");

  return (
    <div className="space-y-6">
      <PlanHeader plan={plan} />

      {/* A returned plan leads with the manager's required feedback so the fix is clear. */}
      {plan.state === "Draft" && latestReturn?.feedback ? (
        <div className="rounded-xl border border-warning/40 bg-warning/[0.06] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-warning">Returned for changes</p>
          <p className="mt-1 text-sm">{latestReturn.feedback}</p>
          {latestReturn.actorName ? (
            <p className="mt-1 text-xs text-muted-foreground">{latestReturn.actorName}</p>
          ) : null}
        </div>
      ) : null}

      {plan.isLocked ? <LockedNotice plan={plan} /> : null}

      {/* Plan progress — a locked plan tracks progress, labeled Plan progress, never a rating. */}
      {plan.isLocked ? <PlanProgressSummary plan={plan} /> : null}

      {/* Objective ledger. */}
      <section className="rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Objectives</span>
          <span className="text-xs text-muted-foreground">{plan.objectives.length}</span>
        </div>

        {plan.objectives.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No objectives yet. Add the first one below.
          </div>
        ) : (
          <div className="divide-y px-5">
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
          <div className="border-t px-5 py-3">
            <Button variant="ghost" size="sm" onClick={() => setComposer({})}>
              <Plus className="size-4" data-icon="inline-start" /> Add objective
            </Button>
          </div>
        ) : null}
      </section>

      {/* Weight summary + submit — author only. Submitted/locked plans show the total read-only. */}
      {plan.canAuthor ? (
        <LiveWeightSummary
          objectives={plan.objectives}
          readiness={plan.readiness}
          canSubmit={plan.canSubmit}
          submitting={mutations.submit.isLoading}
          onSubmit={async () => {
            try {
              await mutations.submit.mutateAsync();
              toast.success("Plan submitted for review.");
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

function PlanProgressSummary({ plan }: { plan: EmployeePlanDto }) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Plan progress</p>
      <div className="mt-1 flex items-end justify-between gap-4">
        <span className={cn("text-4xl font-semibold tabular-nums tracking-tight", plan.planProgress >= 100 ? "text-success" : "text-foreground")}>
          {pct(plan.planProgress)}%
        </span>
      </div>
      {/* Weighted contribution of each objective's capped progress. */}
      <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {plan.objectives.map((objective) => {
          const weight = objective.planWeight ?? 0;
          const capped = objective.hasProgress ? Math.min(objective.derivedProgress, 100) : 0;
          return (
            <span key={objective.id} className="h-full border-r border-background/40 bg-primary/20" style={{ width: `${weight}%` }}>
              <span className="block h-full bg-primary" style={{ width: `${capped}%` }} title={`${objective.title} · ${pct(objective.derivedProgress)}%`} />
            </span>
          );
        })}
      </div>
    </section>
  );
}

function PlanHeader({ plan }: { plan: EmployeePlanDto }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold tracking-tight">My plan</h2>
        <StatusBadge tone={PLAN_STATE_TONE[plan.state]} dot>
          {plan.state === "Submitted" ? "Awaiting your manager" : PLAN_STATE_LABEL[plan.state]}
        </StatusBadge>
      </div>
      {plan.responsibleManager ? (
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <CornerDownRight className="size-3.5" aria-hidden /> Reviewed by {plan.responsibleManager.name ?? "your manager"}
        </span>
      ) : null}
    </div>
  );
}

function LockedNotice({ plan }: { plan: EmployeePlanDto }) {
  const approvedOn = plan.approvedAt ? new Date(plan.approvedAt).toLocaleDateString() : null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-success/40 bg-success/[0.06] p-4">
      <Lock className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
      <div>
        <p className="text-sm font-medium">Approved and locked</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {plan.approvalKind === "Exceptional" ? "Approved by performance administration" : `Approved by ${plan.responsibleManager?.name ?? "your manager"}`}
          {approvedOn ? ` · ${approvedOn}` : ""}
        </p>
      </div>
    </div>
  );
}

function EmptyPanel({ icon: Icon, title, body }: { icon: typeof Target; title: string; body: string }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-dashed p-10 text-center">
      <Icon className="mx-auto size-6 text-muted-foreground" aria-hidden />
      <p className="mt-3 text-base font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
