"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Lock, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@repo/ds/components/ui/avatar";
import { Button } from "@repo/ds/components/ui/button";
import { Textarea } from "@repo/ds/components/ui/textarea";
import { AsyncButton, PageError, PageSkeleton, StatusBadge } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { usePlanDetail, usePlanReviewMutations } from "../../api/use-performance";
import { formatDate } from "../../lib";
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
    <div className="space-y-6 pb-4">
      <Link
        href="/reviews"
        onClick={(event) => {
          event.preventDefault();
          onBack();
        }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> All reviews
      </Link>

      {/* Who and what. */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-11">
            <AvatarFallback>{initials(plan.employee.name)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="type-page-title text-foreground">{plan.employee.name ?? "Employee"}</h1>
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
          <span
            className={cn(
              "type-metric",
              plan.readiness.weightTotal === 100 ? "text-success" : "text-warning"
            )}
          >
            {pct(plan.readiness.weightTotal)}%
          </span>
          <span className="text-muted-foreground">plan weight</span>
        </span>
        <span className="text-muted-foreground">
          {plan.objectives.length} objective{plan.objectives.length === 1 ? "" : "s"} · {aligned} aligned ·{" "}
          {standalone} standalone
        </span>
      </div>

      {/* The whole plan, read for judgement. */}
      <section className="rounded-2xl border border-border bg-card">
        <div className="divide-y divide-border px-5">
          {plan.objectives.map((objective, index) => (
            <PlanObjectiveRow key={objective.id} index={index} objective={objective} />
          ))}
        </div>
      </section>

      {/* Compact terminal state once approved. */}
      {plan.isLocked ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="size-3.5 text-success" aria-hidden />
          <span className="font-medium text-success">Approved &amp; locked</span>
          <span aria-hidden className="text-border">·</span>
          {plan.approvalKind === "Exceptional" ? "by performance administration" : "you approved this plan"}
          {plan.approvedAt ? ` · ${formatDate(plan.approvedAt.slice(0, 10))}` : ""}
        </p>
      ) : null}

      {/* Decision surface — a sticky bar that keeps the decision beside the reviewed plan. */}
      {plan.canDecide ? (
        <div className="sticky bottom-0 -mx-6 border-t border-border bg-background/95 px-6 py-3.5 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          {returning ? (
            <div className="space-y-3">
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                placeholder="What should change before this plan is an agreement?"
                autoFocus
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  The employee sees this and can revise and resubmit.
                </span>
                <div className="flex gap-2">
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
                        onBack();
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Could not return the plan.");
                      }
                    }}
                  >
                    Return for changes
                  </AsyncButton>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Approve to lock this plan as the agreed baseline, or return it with feedback.
              </p>
              <div className="flex gap-2">
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
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
