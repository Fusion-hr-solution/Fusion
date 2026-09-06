"use client";

import { useMemo, useState } from "react";
import { Check, Clock, Landmark, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { AlignmentTargetDto, CycleSummaryDto, EmployeePlanDto, PlanObjectiveDto } from "@repo/api";
import { Avatar, AvatarFallback } from "@repo/ds/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ds/components/ui/alert-dialog";
import { Button } from "@repo/ds/components/ui/button";
import { Textarea } from "@repo/ds/components/ui/textarea";
import { AsyncButton, PageError, PageSkeleton, StatusBadge } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import {
  useAlignmentTargets,
  usePerformanceAccess,
  usePlanDetail,
  usePlanReviewMutations,
} from "../../api/use-performance";
import { formatDate } from "../../lib";
import { PerformanceBreadcrumbLabel } from "@/shell/performance-breadcrumb";
import { ObjectiveDetailDrawer } from "./objective-detail-drawer";
import { PlanBannerMark } from "./plan-banner";
import { PlanDirection } from "./plan-direction";
import { PlanObjectiveRow } from "./plan-objective-row";
import { initials, pct } from "./plan-lib";

/**
 * The reviewer's view of a submitted Plan — the same Plan resource an employee authors, opened by its
 * assigned reviewer to make one plan-level decision. It leads with whose Plan this is and why the
 * reviewer is here, carries the review context (submitted, count, allocation) once, and reuses the
 * employee Plan's own grammar for direction and the objective ledger so it reads as the same Plan,
 * curated for a different responsibility. The Plan is read-only; the only actions are the two
 * decisions, and they appear only for the legitimate assigned reviewer (server-authorized via
 * `canDecide`). Approving or returning transitions the real Plan and refreshes this resource in place.
 */
export function PlanReview({ cycle, planId }: { cycle: CycleSummaryDto; planId: string }) {
  const detail = usePlanDetail(cycle.id, planId);
  const targetsQuery = useAlignmentTargets(cycle.id);
  const access = usePerformanceAccess();

  if (detail.isLoading) return <PageSkeleton rows={5} label="Loading plan" />;
  if (detail.error || !detail.data) {
    return <PageError title="Plan unavailable" description={detail.error?.message} onRetry={detail.refetch} />;
  }

  const plan = detail.data;
  const targets = targetsQuery.data ?? [];

  const a = access.data;
  const canViewOrgGoals =
    (a?.canAdminister ?? false) ||
    a?.aggregateViewScope === "DirectReports" ||
    a?.aggregateViewScope === "OrgUnit" ||
    a?.aggregateViewScope === "Tenant" ||
    (a?.canPublishStrategy ?? false) ||
    (a?.canManageOrgObjectives ?? false);

  const firstName = plan.employee.name?.trim().split(/\s+/)[0] ?? "the employee";

  return (
    <div className="space-y-4">
      {/* Replace the raw plan-id segment in the shell breadcrumb with the employee's name. */}
      <PerformanceBreadcrumbLabel segment={planId} label={plan.employee.name ?? undefined} />

      <ReviewHeading plan={plan} />

      <PlanDirection
        objectives={plan.objectives}
        targets={targets}
        reviewerName={plan.responsibleManager?.name ?? null}
        canViewOrgGoals={canViewOrgGoals}
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <ObjectiveLedgerReadOnly plan={plan} targets={targets} />

        <aside className="space-y-4 lg:sticky lg:top-6">
          <ReviewContextCard plan={plan} firstName={firstName} />
          <ReviewDecision plan={plan} cycleId={cycle.id} planId={planId} firstName={firstName} />
        </aside>
      </div>
    </div>
  );
}

/** The lifecycle badge as the reviewer reads it: submitted plans await, then resolve to approved/returned. */
function ReviewStateBadge({ plan }: { plan: EmployeePlanDto }) {
  if (plan.state === "Approved") {
    return (
      <StatusBadge tone="success" dot>
        Approved
      </StatusBadge>
    );
  }
  const returned = plan.state === "Draft" && plan.history.some((h) => h.kind === "Returned");
  if (returned) {
    return (
      <StatusBadge tone="warning" dot>
        Returned
      </StatusBadge>
    );
  }
  return (
    <StatusBadge tone="warning" dot>
      Submitted
    </StatusBadge>
  );
}

/**
 * Whose plan and why: the employee's avatar anchors the name (with the plan's state) and, directly
 * beneath it, the org unit and the reason the reviewer is here — one identity block, no cycle subtitle.
 */
function ReviewHeading({ plan }: { plan: EmployeePlanDto }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-3.5">
        <Avatar className="size-12">
          <AvatarFallback>{initials(plan.employee.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="inline-flex flex-wrap items-center gap-2.5 type-page-title text-foreground">
            {plan.employee.name ?? "Employee"}
            <ReviewStateBadge plan={plan} />
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted-foreground">
            {plan.orgUnitName ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <Landmark className="size-3.5" aria-hidden />
                  {plan.orgUnitName}
                </span>
                <span aria-hidden className="text-border">
                  ·
                </span>
              </>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" aria-hidden />
              Submitted for your review
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * The review context, stated once: what stage the decision is at, and the three facts that frame it —
 * when it was submitted, how many objectives, how much of the plan is allocated. The lead adapts to the
 * plan's state so a resolved plan reads as resolved rather than still-awaiting.
 */
function ReviewContextCard({ plan, firstName }: { plan: EmployeePlanDto; firstName: string }) {
  const submittedOn = plan.submittedAt ? formatDate(plan.submittedAt.slice(0, 10)) : null;
  const approvedOn = plan.approvedAt ? formatDate(plan.approvedAt.slice(0, 10)) : null;
  const count = plan.objectives.length;
  const total = plan.readiness.weightTotal;

  const approved = plan.state === "Approved";
  const returned = plan.state === "Draft" && plan.history.some((h) => h.kind === "Returned");

  const lead = approved
    ? {
        icon: Check,
        tint: "text-success bg-success/12 ring-success/20",
        title: "Plan approved",
        detail: `You approved ${firstName}'s plan${approvedOn ? ` on ${approvedOn}` : ""}. It is now the locked baseline.`,
      }
    : returned
      ? {
          icon: RotateCcw,
          tint: "text-warning bg-warning/12 ring-warning/20",
          title: "Changes requested",
          detail: `Returned to ${firstName} to revise and resubmit.`,
        }
      : plan.canDecide
        ? {
            icon: Clock,
            tint: "text-primary bg-primary/12 ring-primary/20",
            title: "Awaiting your review",
            detail: `Review ${firstName}'s submitted commitments and make a plan-level decision.`,
          }
        : {
            icon: Clock,
            tint: "text-muted-foreground bg-muted ring-border",
            title: "Submitted for review",
            detail: plan.responsibleManager?.name
              ? `Held for ${plan.responsibleManager.name}'s decision.`
              : "Held for the reviewer's decision.",
          };
  const Icon = lead.icon;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3.5">
        <PlanBannerMark className={lead.tint}>
          <Icon className="size-5" aria-hidden />
        </PlanBannerMark>
        <div className="min-w-0">
          <p className="font-semibold tracking-tight text-foreground">{lead.title}</p>
          <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{lead.detail}</p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4">
        <ContextFact label={approved ? "Approved" : "Submitted"} value={approved ? approvedOn ?? "—" : submittedOn ?? "—"} />
        <ContextFact label="Objectives" value={String(count)} />
        <ContextFact label="Allocated" value={`${pct(total)}%`} valueClass={total === 100 ? "text-success" : undefined} />
      </dl>
    </section>
  );
}

function ContextFact({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="min-w-0">
      <dt className="type-eyebrow text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 text-sm font-semibold tabular-nums text-foreground", valueClass)}>{value}</dd>
    </div>
  );
}

/** The complete submitted ledger, read for judgement — the same objective rows as My Plan, no actions. */
function ObjectiveLedgerReadOnly({ plan, targets }: { plan: EmployeePlanDto; targets: AlignmentTargetDto[] }) {
  const [detailId, setDetailId] = useState<string | null>(null);

  const scopeByTitle = useMemo(() => {
    const map = new Map<string, string>();
    for (const target of targets) {
      map.set(
        target.title,
        target.ownershipScope === "Company" ? "Company strategy" : target.orgUnitName ?? "Organizational"
      );
    }
    return map;
  }, [targets]);

  const detailIndex = plan.objectives.findIndex((o) => o.id === detailId);
  const detail = detailIndex >= 0 ? plan.objectives[detailIndex] ?? null : null;
  const scopeFor = (objective: PlanObjectiveDto) =>
    objective.isAligned ? scopeByTitle.get(objective.directionPath.at(-1) ?? "") : undefined;

  return (
    <section className="rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <span className="type-eyebrow text-muted-foreground">Submitted objectives</span>
        <span className="text-xs tabular-nums text-muted-foreground">{plan.objectives.length}</span>
      </div>
      <div className="space-y-3 p-4">
        {plan.objectives.map((objective, index) => (
          <PlanObjectiveRow
            key={objective.id}
            index={index}
            objective={objective}
            alignmentScope={scopeFor(objective)}
            active={detailId === objective.id}
            onViewDetails={() => setDetailId(objective.id)}
          />
        ))}
      </div>

      <ObjectiveDetailDrawer
        objective={detail}
        index={detailIndex}
        alignmentScope={detail ? scopeFor(detail) : undefined}
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
      />
    </section>
  );
}

/**
 * The plan-level decision. Only the assigned reviewer (server-authorized `canDecide`) sees the controls:
 * approve the whole plan, which locks it as the agreed baseline, or return the whole plan with required
 * feedback for revision. Once decided, the controls give way to the finalized state — the outcome the
 * review context card already leads with, restated here only as the lock/return record.
 */
function ReviewDecision({
  plan,
  cycleId,
  planId,
  firstName,
}: {
  plan: EmployeePlanDto;
  cycleId: string;
  planId: string;
  firstName: string;
}) {
  const mutations = usePlanReviewMutations(cycleId, planId);
  const [returning, setReturning] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const approving = mutations.approve.isLoading;

  if (plan.canDecide) {
    // Requesting changes is a focused state, not a textarea that appears: the card retitles to the task,
    // states what the feedback is for and the consequence (the whole Plan reopens), and hides Approve so
    // there is one decision to make. Feedback is required — the primary stays disabled until it is real.
    if (returning) {
      const canReturn = feedback.trim().length > 0;
      return (
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="type-eyebrow text-muted-foreground">Request changes</p>
          <p className="mt-2 text-sm text-foreground">
            Tell {firstName} what needs to change before you can approve this Plan.
          </p>
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            className="mt-3"
            placeholder={`Describe the changes ${firstName} should make…`}
            autoFocus
          />
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setReturning(false);
                setFeedback("");
              }}
              disabled={mutations.returnForRevision.isLoading}
            >
              Cancel
            </Button>
            <AsyncButton
              size="sm"
              pending={mutations.returnForRevision.isLoading}
              disabled={!canReturn}
              onClick={async () => {
                try {
                  await mutations.returnForRevision.mutateAsync({ feedback: feedback.trim() });
                  toast.success(`Plan returned to ${firstName} for changes.`);
                  setReturning(false);
                  setFeedback("");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not return the plan.");
                }
              }}
            >
              <RotateCcw className="size-4" data-icon="inline-start" /> Request changes
            </AsyncButton>
          </div>
        </section>
      );
    }

    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="type-eyebrow text-muted-foreground">Review decision</p>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Button variant="outline" onClick={() => setReturning(true)}>
            <RotateCcw className="size-4" data-icon="inline-start" /> Request changes
          </Button>
          <AlertDialog open={approveOpen} onOpenChange={(o) => { if (!approving) setApproveOpen(o); }}>
            <AlertDialogTrigger asChild>
              <Button>
                <Check className="size-4" data-icon="inline-start" /> Approve plan
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Approve this plan?</AlertDialogTitle>
                <AlertDialogDescription>
                  Approving <span className="font-medium text-foreground">locks {firstName}&apos;s plan</span> as
                  the agreed baseline for{" "}
                  <span className="font-medium text-foreground">{plan.cycleName}</span>. It{" "}
                  <span className="font-medium text-foreground">can&apos;t be edited afterward</span> without an
                  administrator.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={approving}>Cancel</AlertDialogCancel>
                <AsyncButton
                  pending={approving}
                  onClick={async () => {
                    try {
                      await mutations.approve.mutateAsync();
                      toast.success("Plan approved and locked.");
                      setApproveOpen(false);
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not approve the plan.");
                    }
                  }}
                >
                  <Check className="size-4" data-icon="inline-start" /> Approve plan
                </AsyncButton>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>
    );
  }

  // Resolved. An approved plan needs no decision block — the review context card already leads with the
  // approval; only a returned plan restates its outcome here.
  if (plan.state === "Approved") return null;

  const returned = plan.state === "Draft" && plan.history.some((h) => h.kind === "Returned");
  if (returned) {
    return (
      <section className="rounded-2xl border border-warning/30 bg-warning/[0.06] p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-warning">
          <RotateCcw className="size-4" aria-hidden /> Changes requested
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Returned to {firstName} to revise and resubmit.
        </p>
      </section>
    );
  }

  return null;
}
