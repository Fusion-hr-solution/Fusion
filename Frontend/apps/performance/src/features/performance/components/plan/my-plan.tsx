"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Check,
  BarChart3,
  Plus,
  Send,
  Share2,
  Target,
  User,
  Users,
} from "@/lib/icons";
import { toast } from "sonner";
import type {
  AddPlanObjectiveRequest,
  AlignmentTargetDto,
  CycleSummaryDto,
  EmployeePlanDto,
  PlanObjectiveDto,
} from "@repo/api";
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
import { AsyncButton, PageError } from "@repo/ds/shell";
import { PlanEmptySkeleton } from "./plan-skeleton";
import { OrgObjectiveDetailDrawer } from "../goals/org-objective-detail-drawer";
import { cn } from "@repo/ds/lib/utils";
import {
  useAlignmentTargets,
  useMyPlan,
  usePerformanceAccess,
  usePlanMutations,
} from "../../api/use-performance";
import { formatDateTime } from "../../lib";
import { PlanDirectionSection, PlanReviewerSection, directionFromTargets } from "./plan-direction";
import { PlanGoalComposer } from "./goal-composer";
import { ObjectiveDetailDrawer } from "./objective-detail-drawer";
import { PlanObjectiveRow } from "./plan-objective-row";
import { PlanSubmissionChecks } from "./plan-submission-checks";
import { PlanSubmissionStatus } from "./plan-submission-status";
import { initials } from "./plan-lib";
import { PlanProgressCard } from "./plan-progress-card";
import { PlanApprovedStatus } from "./plan-approved-status";
import { PlanDocument, PlanSection, PlanWeightStrip, SidebarSection } from "./plan-layout";

/**
 * The employee's Plan as a document with a properties sidebar (see `plan-layout.tsx`). The page heading
 * is rendered here, through `heading`, because its actions depend on the plan: Submit lives in the
 * header, not in a bar under the list.
 */
export function MyPlan({
  cycle,
  heading,
}: {
  cycle: CycleSummaryDto;
  heading: (actions?: ReactNode) => ReactNode;
}) {
  const cycleId = cycle.id;
  const access = usePerformanceAccess();
  const state = useMyPlan(cycleId);
  const targetsQuery = useAlignmentTargets(cycleId, state.data?.participatesInCycle ?? false);
  const mutations = usePlanMutations(cycleId);

  const [composer, setComposer] = useState<{ objective?: PlanObjectiveDto } | null>(null);

  // Organization Goals is an organization-direction surface, not a universal employee destination:
  // the same gate the sidebar uses. "View in Organization Goals" stays hidden for self-only actors.
  const a = access.data;
  const canViewOrgGoals =
    (a?.canAdminister ?? false) ||
    a?.aggregateViewScope === "DirectReports" ||
    a?.aggregateViewScope === "OrgUnit" ||
    a?.aggregateViewScope === "Tenant" ||
    (a?.canPublishStrategy ?? false) ||
    (a?.canManageOrgObjectives ?? false);

  if (state.isLoading) {
    return (
      <>
        {heading()}
        <PlanEmptySkeleton />
      </>
    );
  }
  if (state.error || !state.data) {
    return (
      <>
        {heading()}
        <PageError title="Plan unavailable" description={state.error?.message} onRetry={state.refetch} />
      </>
    );
  }

  const { participatesInCycle, plan, preview } = state.data;

  if (!participatesInCycle) {
    return (
      <>
        {heading()}
        <p className="max-w-md text-sm text-muted-foreground">
          You are not part of this Cycle. When your organization adds you, your plan opens here.
        </p>
      </>
    );
  }

  const targets = targetsQuery.data ?? [];
  const hasObjectives = (plan?.objectives.length ?? 0) > 0;

  // Reviewer and supported direction come from the plan once it exists, and from the participant
  // preview before then — so the not-started and authoring surfaces name the same people.
  const reviewerName = plan?.responsibleManager?.name ?? preview?.reviewer?.name ?? null;

  // The composer is shared across the not-started and authoring surfaces. Before a plan exists it runs
  // on cycle-settings defaults, and the plan is created lazily on the first objective — so opening and
  // cancelling the composer from the not-started surface leaves no empty Draft behind.
  const composerNode = composer ? (
    <PlanGoalComposer
      open
      onOpenChange={(open) => {
        if (!open) setComposer(null);
      }}
      cycle={cycle}
      targets={targets}
      standaloneAllowed={
        plan?.readiness.standaloneAllowed ?? preview?.standaloneAllowed ?? false
      }
      teamName={plan?.orgUnitName ?? preview?.orgUnitName}
      objective={composer.objective}
      otherWeightTotal={(plan?.readiness.weightTotal ?? 0) - (composer.objective?.planWeight ?? 0)}
      onCreate={async (request: AddPlanObjectiveRequest) => {
        // First objective materializes the plan; the two calls are sequential so the plan exists
        // server-side before the objective is added.
        if (!plan) await mutations.create.mutateAsync();
        await mutations.addObjective.mutateAsync(request);
        toast.success("Objective added.");
      }}
      onUpdate={async (request: AddPlanObjectiveRequest) => {
        if (!composer.objective) return;
        await mutations.updateObjective.mutateAsync({ objectiveId: composer.objective.id, request });
        toast.success("Objective updated.");
      }}
    />
  ) : null;

  // No objectives yet — the not-started surface. Pure conditional rendering on the objective count:
  // there is no separate empty-Draft screen. The CTA opens the composer, and adding the first
  // objective creates the plan and reveals the authoring surface in the same place.
  if (!hasObjectives) {
    const directionLevels = directionFromTargets(targets, plan?.orgUnitName ?? preview?.orgUnitName);
    return (
      <>
        {heading()}
        <PlanDocument
          main={<PlanNotStarted cycleName={cycle.name} onStart={() => setComposer({})} />}
          sidebar={
            <>
              <PlanDirectionSection
                objectives={[]}
                targets={targets}
                directionLevels={directionLevels}
                canViewOrgGoals={canViewOrgGoals}
              />
              <PlanReviewerSection reviewerId={preview?.reviewer?.id ?? null} reviewerName={reviewerName} />
              <PlanNextSteps reviewerName={reviewerName} />
            </>
          }
        />
        {composerNode}
      </>
    );
  }

  // From here a plan exists with at least one objective.
  if (!plan) return null;

  const latestReturn = [...plan.history].reverse().find((h) => h.kind === "Returned");
  const returned = plan.state === "Draft" && Boolean(latestReturn);
  const isAuthor = plan.canAuthor;

  // The sidebar leads with the plan's phase and carries only what the objective list does not: while
  // authoring, the reviewer's returned feedback, the submission checks and who will review; once handed
  // over, the review status; once approved, the settled agreement and overall progress. The direction the
  // plan serves leads every phase. Per-objective facts are the list's, so the sidebar never restates them.
  const phase = isAuthor ? (
    <>
      {returned ? (
        <ReviewerFeedback
          reviewer={latestReturn?.actorName ?? plan.responsibleManager?.name ?? "Your reviewer"}
          feedback={latestReturn?.feedback ?? null}
          at={latestReturn?.decidedAt ?? null}
        />
      ) : null}
      <PlanSubmissionChecks readiness={plan.readiness} />
    </>
  ) : plan.state === "Submitted" ? (
    <PlanSubmissionStatus plan={plan} />
  ) : plan.isLocked ? (
    <>
      <PlanApprovedStatus plan={plan} perspective="owner" />
      <PlanProgressCard plan={plan} emptyDescription="Plan progress begins once you update your objectives." />
    </>
  ) : null;
  const sidebar = (
    <>
      <PlanDirectionSection objectives={plan.objectives} targets={targets} canViewOrgGoals={canViewOrgGoals} />
      <PlanReviewerSection
        reviewerId={plan.responsibleManager?.id ?? null}
        reviewerName={reviewerName}
        history={plan.history}
      />
      {phase}
    </>
  );

  const actions = isAuthor ? (
    <SubmitPlanAction
      canSubmit={plan.canSubmit}
      submitting={mutations.submit.isLoading}
      resubmit={returned}
      reviewerName={reviewerName}
      objectiveCount={plan.objectives.length}
      lastSavedAt={plan.lastSavedAt}
      onSubmit={async () => {
        try {
          await mutations.submit.mutateAsync();
          toast.success(returned ? "Plan resubmitted for review." : "Plan submitted for review.");
          return true;
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Could not submit your plan.");
          return false;
        }
      }}
    />
  ) : undefined;

  return (
    <>
      {heading(actions)}
      <PlanDocument
          main={
            <ObjectiveLedger
              plan={plan}
              targets={targets}
              onAdd={() => setComposer({})}
              onEdit={(objective) => setComposer({ objective })}
              onRemove={async (id) => {
                try {
                  await mutations.removeObjective.mutateAsync(id);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not remove the objective.");
                }
              }}
            />
          }
          sidebar={sidebar}
        />
      {composerNode}
    </>
  );
}

/**
 * The plan ledger: a section heading (count, weight total, the single add affordance) over the
 * objective cards, which sit on the canvas. The list is not boxed, so it simply ends after the last card. Authoring actions live per-row behind an overflow menu; a submitted or
 * locked plan renders the same rows without them.
 */
function ObjectiveLedger({
  plan,
  targets,
  onAdd,
  onEdit,
  onRemove,
}: {
  plan: EmployeePlanDto;
  targets: AlignmentTargetDto[];
  onAdd: () => void;
  onEdit: (objective: PlanObjectiveDto) => void;
  onRemove: (objectiveId: string) => void;
}) {
  // One drawer, two modes: the eye opens details; Update progress opens the same drawer in record mode.
  const [drawer, setDrawer] = useState<{ id: string; mode: "details" | "record" } | null>(null);
  const detailId = drawer?.id ?? null;
  const [alignedId, setAlignedId] = useState<string | null>(null);

  // Resolve each aligned objective's parent scope label (e.g. "Talent Pod") once from the targets.
  const scopeByTitle = useMemo(() => {
    const map = new Map<string, string>();
    for (const target of targets) {
      map.set(target.title, target.ownershipScope === "Company" ? "Company strategy" : target.orgUnitName ?? "Organizational");
    }
    return map;
  }, [targets]);

  const scopeFor = (objective: PlanObjectiveDto) =>
    objective.isAligned ? scopeByTitle.get(objective.directionPath.at(-1) ?? "") : undefined;
  const detailIndex = plan.objectives.findIndex((o) => o.id === detailId);
  const detail = detailIndex >= 0 ? plan.objectives[detailIndex] ?? null : null;

  return (
    <PlanSection
      label="Objectives"
      count={plan.objectives.length}
      summary={<PlanWeightStrip segments={plan.objectives.map((o) => ({ weight: o.planWeight ?? 0, aligned: o.isAligned }))} />}
      action={
        plan.canAuthor ? (
          <Button
            size="sm"
            onClick={onAdd}
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            <Plus className="size-4" data-icon="inline-start" /> Add objective
          </Button>
        ) : null
      }
    >

      {plan.objectives.length === 0 ? (
        <div className="rounded-surface border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
          No objectives yet. Add the first one to start building your plan.
        </div>
      ) : (
        <div className="space-y-3">
          {plan.objectives.map((objective, index) => (
            // On a locked plan the row grows an execution band (progress ring, latest reported value,
            // Update progress) while the baseline above it stays read-only.
            <PlanObjectiveRow
              key={objective.id}
              index={index}
              objective={objective}
              alignmentScope={scopeFor(objective)}
              showProgress={plan.isLocked}
              active={detailId === objective.id}
              onEdit={plan.canAuthor ? () => onEdit(objective) : undefined}
              onRemove={plan.canAuthor ? () => onRemove(objective.id) : undefined}
              onOpenProgress={plan.isLocked ? () => setDrawer({ id: objective.id, mode: "record" }) : undefined}
              onViewDetails={() => setDrawer({ id: objective.id, mode: "details" })}
              onViewAlignment={setAlignedId}
            />
          ))}
        </div>
      )}

      <ObjectiveDetailDrawer
        objective={detail}
        index={detailIndex}
        alignmentScope={detail ? scopeFor(detail) : undefined}
        open={drawer !== null}
        onOpenChange={(open) => {
          if (!open) setDrawer(null);
        }}
        cycleId={plan.isLocked ? plan.cycleId : undefined}
        initialMode={drawer?.mode ?? "details"}
      />
      <OrgObjectiveDetailDrawer
        cycleId={plan.cycleId}
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
 * The plan-level terminal action while authoring, in the page header. Every objective edit already
 * persists to the Draft, so there is no separate save: the quiet saved time states that truth, and
 * Submit is the one dominant action, naming the reviewer it hands the agreement to.
 */
function SubmitPlanAction({
  canSubmit,
  submitting,
  resubmit,
  reviewerName,
  objectiveCount,
  lastSavedAt,
  onSubmit,
}: {
  canSubmit: boolean;
  submitting: boolean;
  resubmit: boolean;
  reviewerName: string | null;
  objectiveCount: number;
  lastSavedAt: string;
  onSubmit: () => Promise<boolean>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const reviewer = reviewerName ?? "your reviewer";
  return (
    <>
      <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
        <Check className="size-3.5 text-success" aria-hidden />
        Saved {formatDateTime(lastSavedAt)}
      </span>
      <AlertDialog open={confirmOpen} onOpenChange={(o) => { if (!submitting) setConfirmOpen(o); }}>
        <AlertDialogTrigger asChild>
          <Button disabled={!canSubmit}>
            <Send className="size-4" data-icon="inline-start" /> {resubmit ? "Resubmit plan" : "Submit plan"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{resubmit ? "Resubmit your plan?" : "Submit your plan?"}</AlertDialogTitle>
            <AlertDialogDescription>
              Your{" "}
              <span className="font-medium text-foreground">
                {objectiveCount} objective{objectiveCount === 1 ? "" : "s"}
              </span>{" "}
              go to <span className="font-medium text-foreground">{reviewer}</span>. You{" "}
              <span className="font-medium text-foreground">can&apos;t edit them</span> while the plan is in review.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Keep editing</AlertDialogCancel>
            <AsyncButton
              pending={submitting}
              onClick={async () => {
                if (await onSubmit()) setConfirmOpen(false);
              }}
            >
              <Send className="size-4" data-icon="inline-start" /> {resubmit ? "Resubmit" : "Submit"}
            </AsyncButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * The reviewer's returned decision, read as their message to the author: who asked, when, and their
 * verbatim feedback quoted, closing with the ask to revise. Leads the rail on a returned plan so the
 * required change is the first thing seen, not a status chip.
 */
function ReviewerFeedback({
  reviewer,
  feedback,
  at,
}: {
  reviewer: string;
  feedback: string | null;
  at: string | null;
}) {
  return (
    <SidebarSection label="Reviewer feedback">
      <p className="mt-3 text-base font-semibold tracking-tight text-warning">Changes requested</p>

      <div className="mt-3 flex items-center gap-2.5">
        <Avatar className="size-6">
          <AvatarFallback className="text-[0.625rem]">{initials(reviewer)}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 truncate text-sm font-medium text-foreground">{reviewer}</span>
        {at ? (
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">{formatDateTime(at)}</span>
        ) : null}
      </div>

      {feedback ? (
        <blockquote className="mt-4 border-l-2 border-warning/60 pl-4">
          <p className="text-sm leading-relaxed text-foreground/85">{feedback}</p>
        </blockquote>
      ) : null}

      <p className="mt-4 text-sm text-muted-foreground">Revise your plan and resubmit when ready.</p>
    </SidebarSection>
  );
}

/**
 * The not-started ledger: the objectives surface before a plan exists. A single document-and-plus mark
 * over the one dominant action, naming the Cycle and the reviewer who will hold the agreement. The
 * inspiration footer doubles as the quiet path to Organization Goals for those who can see it.
 */
function PlanNotStarted({
  cycleName,
  onStart,
}: {
  cycleName: string;
  onStart: () => void;
}) {
  return (
    <PlanSection label="Objectives">
      <div className="flex flex-col items-center rounded-surface border border-border bg-card px-6 py-12 text-center">
        <PlanIllustration />
        <h2 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
          Create your {cycleName} plan
        </h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Define your objectives and align them to your team.
        </p>

        <ul className="mt-8 grid w-full max-w-3xl gap-5 text-left sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border">
          {PLAN_PILLARS.map(({ icon: Icon, title }) => (
            <li key={title} className="flex items-center justify-center gap-3 sm:px-5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-inlay text-muted-foreground">
                <Icon className="size-4" aria-hidden />
              </span>
              <p className="text-sm font-semibold text-foreground">{title}</p>
            </li>
          ))}
        </ul>

        <Button size="lg" onClick={onStart} className="mt-8">
          <Plus data-icon="inline-start" aria-hidden />
          Start my plan
        </Button>
      </div>
    </PlanSection>
  );
}

const PLAN_PILLARS = [
  { icon: Target, title: "Set meaningful objectives" },
  { icon: Share2, title: "Align to your team" },
  { icon: BarChart3, title: "Track progress" },
] as const;

/** A plan document with a target, linked from you to your team by dotted amber connectors. */
function PlanIllustration() {
  return (
    <div className="relative h-36 w-72" aria-hidden>
      <span className="absolute left-1/2 top-1/2 size-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-inlay" />
      <svg className="absolute inset-0 size-full text-muted-foreground/50" viewBox="0 0 288 144" fill="none">
        <path d="M58 100 C 70 80, 80 70, 100 64" stroke="currentColor" strokeDasharray="3 4" />
        <path d="M188 88 C 205 88, 215 80, 230 72" stroke="currentColor" strokeDasharray="3 4" />
      </svg>
      <span className="absolute left-[98px] top-[60px] size-2 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
      <span className="absolute left-[184px] top-[84px] size-2 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
      <div className="absolute left-1/2 top-2 flex h-32 w-28 -translate-x-1/2 flex-col gap-2 rounded-surface border border-border bg-card p-3 shadow-lg">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Target className="size-5" />
        </span>
        <span className="mt-2 h-1.5 w-3/4 rounded-full bg-muted" />
        <span className="h-1.5 w-full rounded-full bg-muted" />
        <span className="h-1.5 w-2/3 rounded-full bg-muted" />
      </div>
      <span className="absolute left-9 top-[92px] flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
        <User className="size-4" />
      </span>
      <span className="absolute right-9 top-[48px] flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
        <Users className="size-4" />
      </span>
    </div>
  );
}

/**
 * The planning path from here: author, submit, and manager review, as a three-step numbered rail with
 * the first step live. It names the reviewer the plan will go to, so the sequence is concrete.
 */
function PlanNextSteps({ reviewerName }: { reviewerName: string | null }) {
  const steps = [
    { title: "Create your plan", desc: "Add objectives and assign weights.", active: true },
    {
      title: "Submit for review",
      desc: reviewerName
        ? `Once complete, submit your plan to ${reviewerName}.`
        : "Once complete, submit your plan for review.",
      active: false,
    },
    { title: "Manager reviews", desc: "You'll be notified once a decision is made.", active: false },
  ];

  return (
    <SidebarSection label="Next steps">
      <ol className="mt-5">
        {steps.map((step, index) => (
          <li key={step.title} className="relative flex gap-3.5 pb-6 last:pb-0">
            {index < steps.length - 1 ? (
              <span className="absolute left-4 top-10 bottom-2 w-px -translate-x-1/2 bg-border" aria-hidden />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                step.active
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-inlay text-muted-foreground"
              )}
            >
              {index + 1}
            </span>
            <div className="min-w-0 pt-1">
              <p className="text-sm font-medium leading-tight text-foreground">{step.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{step.desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </SidebarSection>
  );
}

