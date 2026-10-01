"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check, Clock, Landmark, LineChart, RotateCcw } from "@/lib/icons";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ds/components/ui/dialog";
import { Textarea } from "@repo/ds/components/ui/textarea";
import { AsyncButton, PageError, StatusBadge } from "@repo/ds/shell";
import {
  useAlignmentTargets,
  usePlanDetail,
  usePlanReviewMutations,
} from "../../api/use-performance";
import { formatDate } from "../../lib";
import { PerformanceBreadcrumbLabel } from "@/shell/performance-breadcrumb";
import { OrgObjectiveDetailDrawer } from "../goals/org-objective-detail-drawer";
import { ObjectiveDetailDrawer } from "./objective-detail-drawer";
import { PlanBannerMark } from "./plan-banner";
import { PlanDirectionSection } from "./plan-direction";
import { PlanDocument, PlanSection, PlanWeightStrip, SidebarSection } from "./plan-layout";
import { PlanObjectiveRow } from "./plan-objective-row";
import { PlanProgressCard } from "./plan-progress-card";
import { PlanApprovedStatus } from "./plan-approved-status";
import { PlanSurfaceSkeleton } from "./plan-skeleton";
import { initials } from "./plan-lib";

/**
 * The reviewer's view of a submitted Plan — the same Plan resource an employee authors, opened by its
 * assigned reviewer to make one plan-level decision. It uses the employee Plan's own document + sidebar
 * layout so it reads as the same Plan, curated for a different responsibility: whose plan and the
 * decision in the header, the objectives as the document, the review context in the sidebar. The Plan
 * is read-only; the only actions are the two decisions, shown only to the legitimate assigned reviewer
 * (server-authorized via `canDecide`). Deciding transitions the real Plan and refreshes it in place.
 */
export function PlanReview({ cycle, planId }: { cycle: CycleSummaryDto; planId: string }) {
  const detail = usePlanDetail(cycle.id, planId);
  const targetsQuery = useAlignmentTargets(cycle.id);

  if (detail.isLoading) return <PlanSurfaceSkeleton />;
  if (detail.error || !detail.data) {
    return <PageError title="Plan unavailable" description={detail.error?.message} onRetry={detail.refetch} />;
  }

  const plan = detail.data;
  const targets = targetsQuery.data ?? [];

  const firstName = plan.employee.name?.trim().split(/\s+/)[0] ?? "the employee";

  return (
    <div className="space-y-8">
      {/* Replace the raw plan-id segment in the shell breadcrumb with the employee's name. */}
      <PerformanceBreadcrumbLabel segment={planId} label={plan.employee.name ?? undefined} />

      <ReviewHeading
        plan={plan}
        actions={
          plan.canDecide ? (
            <ReviewDecision plan={plan} cycleId={cycle.id} planId={planId} firstName={firstName} />
          ) : null
        }
      />

      <PlanDocument
        main={<ObjectiveLedgerReadOnly plan={plan} targets={targets} cycleId={cycle.id} />}
        sidebar={
          plan.isLocked ? (
            // Approved reads as the same settled agreement the owner sees.
            <>
              <PlanApprovedStatus plan={plan} perspective="reviewer" subjectFirstName={firstName} />
              <PlanDirectionSection cycleId={cycle.id} objectives={plan.objectives} targets={targets} />
              <PlanProgressCard plan={plan} />
            </>
          ) : (
            <>
              <ReviewContext plan={plan} firstName={firstName} />
              <PlanDirectionSection cycleId={cycle.id} objectives={plan.objectives} targets={targets} />
            </>
          )
        }
      />
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
 * beneath it, the org unit and the reason the reviewer is here. The decision sits opposite, as the
 * page's primary actions.
 */
function ReviewHeading({ plan, actions }: { plan: EmployeePlanDto; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3.5">
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
              <span className="inline-flex items-center gap-1.5">
                <Landmark className="size-3.5" aria-hidden />
                {plan.orgUnitName}
              </span>
            ) : null}
            {plan.orgUnitName && plan.state === "Approved" ? (
              <span aria-hidden className="text-border">
                ·
              </span>
            ) : null}
            {plan.state === "Approved" ? (
              <span className="inline-flex items-center gap-1.5">
                <LineChart className="size-3.5" aria-hidden />
                Tracking execution
              </span>
            ) : null}
          </p>
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * The review context in the sidebar: what stage the decision is at, then the facts the objective list
 * does not already carry — when it was submitted and how the plan splits between direction-aligned and
 * standalone objectives. Count and weight total live on the list heading. The lead adapts to the plan's
 * state so a returned plan reads as returned rather than still-awaiting.
 */
function ReviewContext({ plan, firstName }: { plan: EmployeePlanDto; firstName: string }) {
  const submittedOn = plan.submittedAt ? formatDate(plan.submittedAt.slice(0, 10)) : null;
  const aligned = plan.objectives.filter((o) => o.isAligned).length;
  const standalone = plan.objectives.length - aligned;

  const returned = plan.state === "Draft" && plan.history.some((h) => h.kind === "Returned");

  const lead = returned
    ? {
        icon: RotateCcw,
        tint: "text-warning bg-warning/12 ring-warning/20",
        title: "Changes requested",
        detail: `Returned to ${firstName} to revise and resubmit.`,
      }
    : plan.canDecide
      ? {
          icon: Clock,
          tint: "text-primary-ink bg-primary-tint ring-primary-ring",
          title: "Awaiting your review",
          detail: `Review ${firstName}'s objectives, then approve or request changes.`,
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
    <>
      <SidebarSection>
        <div className="flex items-start gap-3.5">
          <PlanBannerMark className={lead.tint}>
            <Icon className="size-5" aria-hidden />
          </PlanBannerMark>
          <div className="min-w-0">
            <p className="font-semibold tracking-tight text-foreground">{lead.title}</p>
            <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{lead.detail}</p>
          </div>
        </div>
      </SidebarSection>

      <SidebarSection>
        <dl className="space-y-4">
          <ContextFact label="Submitted" value={submittedOn ?? "—"} />
          <ContextFact
            label="Alignment"
            value={
              <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                  {aligned} aligned
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-info" aria-hidden />
                  {standalone} standalone
                </span>
              </span>
            }
          />
        </dl>
      </SidebarSection>
    </>
  );
}

function ContextFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="type-eyebrow text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

/**
 * The complete ledger, read for the manager's responsibility — the same objective cards as My Plan, no
 * authoring or recording actions. While the plan is submitted it reads as the baseline under review; once
 * approved and locked it grows the same execution band and progress-bearing detail drawer the employee
 * sees, so the manager tracks the identical execution truth — minus the controls that are the owner's.
 */
function ObjectiveLedgerReadOnly({
  plan,
  targets,
  cycleId,
}: {
  plan: EmployeePlanDto;
  targets: AlignmentTargetDto[];
  cycleId: string;
}) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [alignedId, setAlignedId] = useState<string | null>(null);

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
    <PlanSection
      label="Objectives"
      count={plan.objectives.length}
      summary={<PlanWeightStrip segments={plan.objectives.map((o) => ({ weight: o.planWeight ?? 0, aligned: o.isAligned }))} />}
    >
      <div className="space-y-3">
        {plan.objectives.map((objective, index) => (
          // On an approved plan the row grows its execution band (current value + progress) — read-only,
          // with no Update progress: recording is the owner's, gated away here.
          <PlanObjectiveRow
            key={objective.id}
            index={index}
            objective={objective}
            alignmentScope={scopeFor(objective)}
            showProgress={plan.isLocked}
            active={detailId === objective.id}
            onViewDetails={() => setDetailId(objective.id)}
            onViewAlignment={setAlignedId}
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
        // On a locked plan the drawer carries current progress + history; record mode stays hidden because
        // the objective is not the manager's to update (`canUpdateProgress` is false server-side).
        cycleId={plan.isLocked ? cycleId : undefined}
      />
      <OrgObjectiveDetailDrawer
        cycleId={cycleId}
        objectiveId={alignedId}
        open={alignedId !== null}
        onOpenChange={(open) => {
          if (!open) setAlignedId(null);
        }}
      />
    </PlanSection>
  );
}

/**
 * The plan-level decision, as the page's primary actions. Only the assigned reviewer (server-authorized
 * `canDecide`) gets it: approve the whole plan, which locks it as the agreed baseline, or return it with
 * required feedback. Both are consequential, so each confirms in a dialog; returning asks for the
 * feedback there, and its primary stays disabled until the feedback is real.
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
  const [returnOpen, setReturnOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const approving = mutations.approve.isLoading;
  const returning = mutations.returnForRevision.isLoading;
  const canReturn = feedback.trim().length > 0;

  return (
    <>
      <Dialog
        open={returnOpen}
        onOpenChange={(o) => {
          if (returning) return;
          setReturnOpen(o);
          if (!o) setFeedback("");
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline">
            <RotateCcw className="size-4" data-icon="inline-start" /> Request changes
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
            <DialogDescription>
              The whole plan reopens for {firstName} to revise and resubmit.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label={`What should ${firstName} change?`}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={5}
            className="min-h-32"
            placeholder={`What should ${firstName} change?`}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)} disabled={returning}>
              Cancel
            </Button>
            <AsyncButton
              pending={returning}
              disabled={!canReturn}
              onClick={async () => {
                try {
                  await mutations.returnForRevision.mutateAsync({ feedback: feedback.trim() });
                  toast.success(`Plan returned to ${firstName} for changes.`);
                  setReturnOpen(false);
                  setFeedback("");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not return the plan.");
                }
              }}
            >
              <RotateCcw className="size-4" data-icon="inline-start" /> Return plan
            </AsyncButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </>
  );
}
