"use client";

import { useState } from "react";
import { ArrowLeft, Check, Lock, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@repo/ds/components/ui/avatar";
import { Button } from "@repo/ds/components/ui/button";
import { Textarea } from "@repo/ds/components/ui/textarea";
import { AsyncButton, PageError, PageSkeleton, StatusBadge } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { usePlanDetail, usePlanReviewMutations } from "../../api/use-performance";
import { PlanObjectiveRow } from "./plan-objective-row";
import { PLAN_STATE_LABEL, PLAN_STATE_TONE, initials, pct } from "./plan-lib";

/**
 * The Manager Decision Workspace — the manager's job is to judge whether the whole plan is a
 * coherent agreement, so this is a decision surface, not the employee's editor rendered read-only.
 * It surfaces the employee, the complete weighted plan with its alignment, and a single clear
 * decision: return with required feedback, or approve, which locks the baseline.
 */
export function ManagerDecisionWorkspace({
  cycleId,
  planId,
  onBack,
}: {
  cycleId: string;
  planId: string;
  onBack: () => void;
}) {
  const detail = usePlanDetail(cycleId, planId);
  const mutations = usePlanReviewMutations(cycleId, planId);
  const [returning, setReturning] = useState(false);
  const [feedback, setFeedback] = useState("");

  if (detail.isLoading) return <PageSkeleton rows={4} label="Loading plan" />;
  if (detail.error || !detail.data) {
    return <PageError title="Plan unavailable" description={detail.error?.message} onRetry={detail.refetch} />;
  }

  const plan = detail.data;
  const aligned = plan.objectives.filter((o) => o.isAligned).length;
  const standalone = plan.objectives.length - aligned;

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All reviews
      </button>

      {/* Who and what. */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-11">
            <AvatarFallback>{initials(plan.employee.name)}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{plan.employee.name ?? "Employee"}</h2>
            <p className="text-sm text-muted-foreground">{plan.orgUnitName ?? "No organizational unit"}</p>
          </div>
        </div>
        <StatusBadge tone={PLAN_STATE_TONE[plan.state]} dot>
          {plan.state === "Submitted" ? "Awaiting your decision" : PLAN_STATE_LABEL[plan.state]}
        </StatusBadge>
      </div>

      {/* Plan shape at a glance. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span className="inline-flex items-baseline gap-1.5">
          <span className={cn("text-lg font-semibold tabular-nums", plan.readiness.weightTotal === 100 ? "text-success" : "text-warning")}>
            {pct(plan.readiness.weightTotal)}%
          </span>
          <span className="text-muted-foreground">plan weight</span>
        </span>
        <span className="text-muted-foreground">
          {plan.objectives.length} objective{plan.objectives.length === 1 ? "" : "s"} · {aligned} aligned · {standalone} standalone
        </span>
      </div>

      {/* The whole plan, read for judgement. */}
      <section className="rounded-2xl border bg-card">
        <div className="divide-y px-5">
          {plan.objectives.map((objective, index) => (
            <PlanObjectiveRow key={objective.id} index={index} objective={objective} />
          ))}
        </div>
      </section>

      {plan.isLocked ? (
        <div className="flex items-start gap-3 rounded-xl border border-success/40 bg-success/[0.06] p-4">
          <Lock className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <div>
            <p className="text-sm font-medium">Approved and locked</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {plan.approvalKind === "Exceptional" ? "Approved by performance administration" : "You approved this plan"}
              {plan.approvedAt ? ` · ${new Date(plan.approvedAt).toLocaleDateString()}` : ""}
            </p>
          </div>
        </div>
      ) : null}

      {/* Decision surface — only when this manager may decide a submitted plan. */}
      {plan.canDecide ? (
        <section className="rounded-2xl border border-primary/30 bg-primary/[0.03] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Your decision</p>

          {returning ? (
            <div className="mt-3 space-y-3">
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                placeholder="What should change before this plan is an agreement?"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setReturning(false)} disabled={mutations.returnForRevision.isLoading}>
                  Cancel
                </Button>
                <AsyncButton
                  pending={mutations.returnForRevision.isLoading}
                  disabled={feedback.trim() === ""}
                  onClick={async () => {
                    try {
                      await mutations.returnForRevision.mutateAsync({ feedback: feedback.trim() });
                      toast.success("Plan returned for changes.");
                      setReturning(false);
                      setFeedback("");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not return the plan.");
                    }
                  }}
                >
                  Return for changes
                </AsyncButton>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setReturning(true)}>
                <RotateCcw className="size-4" data-icon="inline-start" /> Return for changes
              </Button>
              <AsyncButton
                pending={mutations.approve.isLoading}
                onClick={async () => {
                  try {
                    await mutations.approve.mutateAsync();
                    toast.success("Plan approved and locked.");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not approve the plan.");
                  }
                }}
              >
                <Check className="size-4" data-icon="inline-start" /> Approve plan
              </AsyncButton>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
