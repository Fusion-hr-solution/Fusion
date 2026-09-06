"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock,
  FileText,
  History,
  Lightbulb,
  MessageSquareQuote,
  Plus,
  Quote,
} from "lucide-react";
import { toast } from "sonner";
import type {
  AddPlanObjectiveRequest,
  AlignmentTargetDto,
  CycleSummaryDto,
  EmployeePlanDto,
  PlanObjectiveDto,
} from "@repo/api";
import { Avatar, AvatarFallback } from "@repo/ds/components/ui/avatar";
import { Button } from "@repo/ds/components/ui/button";
import { AllocationGauge, AsyncButton, PageError, PageSkeleton } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import {
  useAlignmentTargets,
  useMyPlan,
  usePerformanceAccess,
  usePlanMutations,
  useSettings,
} from "../../api/use-performance";
import { formatDate, formatDateTime } from "../../lib";
import { PlanDirection, directionFromTargets } from "./plan-direction";
import { PlanGoalComposer } from "./goal-composer";
import { ObjectiveDetailDrawer } from "./objective-detail-drawer";
import { PlanObjectiveRow } from "./plan-objective-row";
import { PlanSubmissionChecks } from "./plan-submission-checks";
import { PlanSubmissionStatus } from "./plan-submission-status";
import { initials, pct, weightTone } from "./plan-lib";
import { ObjectiveProgressPanel } from "../progress/objective-progress-panel";

export function MyPlan({ cycle }: { cycle: CycleSummaryDto }) {
  const cycleId = cycle.id;
  const access = usePerformanceAccess();
  const state = useMyPlan(cycleId);
  const targetsQuery = useAlignmentTargets(cycleId, state.data?.participatesInCycle ?? false);
  const settingsQuery = useSettings(state.data?.participatesInCycle ?? false);
  const mutations = usePlanMutations(cycleId);

  const [composer, setComposer] = useState<{ objective?: PlanObjectiveDto } | null>(null);
  const [progressFor, setProgressFor] = useState<string | null>(null);

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

  if (state.isLoading) return <PageSkeleton rows={4} label="Loading your plan" />;
  if (state.error || !state.data) {
    return <PageError title="Plan unavailable" description={state.error?.message} onRetry={state.refetch} />;
  }

  const { participatesInCycle, plan, preview } = state.data;

  if (!participatesInCycle) {
    return (
      <p className="max-w-md text-sm text-muted-foreground">
        You are not part of this Cycle. When your organization adds you, your plan opens here.
      </p>
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
        plan?.readiness.standaloneAllowed ?? settingsQuery.data?.allowStandaloneObjectives ?? false
      }
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
      <div className="space-y-4">
        <PlanDirection
          objectives={[]}
          targets={targets}
          directionLevels={directionLevels}
          reviewerName={reviewerName}
          canViewOrgGoals={canViewOrgGoals}
        />

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <PlanNotStarted
            cycleName={cycle.name}
            reviewerName={reviewerName}
            canViewOrgGoals={canViewOrgGoals}
            onStart={() => setComposer({})}
          />
          <aside className="space-y-4 lg:sticky lg:top-6">
            <PlanSnapshotEmpty />
            <PlanNextSteps reviewerName={reviewerName} />
          </aside>
        </div>

        {composerNode}
      </div>
    );
  }

  // From here a plan exists with at least one objective.
  if (!plan) return null;

  const latestReturn = [...plan.history].reverse().find((h) => h.kind === "Returned");
  const returned = plan.state === "Draft" && Boolean(latestReturn);
  const isAuthor = plan.canAuthor;

  // The rail follows the plan's phase: allocation + submission checks while authoring; allocation +
  // submission status once the plan is handed to the reviewer; the finalized status + plan progress
  // once approved and locked.
  const rail = isAuthor ? (
    <>
      {returned ? (
        <ReviewerFeedback
          reviewer={latestReturn?.actorName ?? plan.responsibleManager?.name ?? "Your reviewer"}
          feedback={latestReturn?.feedback ?? null}
          at={latestReturn?.decidedAt ?? null}
        />
      ) : null}
      <PlanSnapshot plan={plan} />
      <PlanSubmissionChecks readiness={plan.readiness} />
    </>
  ) : plan.state === "Submitted" ? (
    <>
      <PlanSnapshot plan={plan} />
      <PlanSubmissionStatus plan={plan} />
    </>
  ) : plan.isLocked ? (
    <>
      <PlanSubmissionStatus plan={plan} />
      <PlanProgressSummary plan={plan} />
    </>
  ) : null;

  return (
    <div className="space-y-4">
      <PlanDirection
        objectives={plan.objectives}
        targets={targets}
        reviewerName={plan.responsibleManager?.name ?? null}
        canViewOrgGoals={canViewOrgGoals}
      />

      <div className={cn(rail && "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]")}>
        <div className="space-y-4">
          <ObjectiveLedger
            plan={plan}
            targets={targets}
            onAdd={() => setComposer({})}
            onEdit={(objective) => setComposer({ objective })}
            onOpenProgress={(id) => setProgressFor(id)}
            onRemove={async (id) => {
              try {
                await mutations.removeObjective.mutateAsync(id);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not remove the objective.");
              }
            }}
          />
        </div>

        {rail ? <aside className="space-y-4 lg:sticky lg:top-6">{rail}</aside> : null}
      </div>

      {isAuthor ? (
        <PlanActionBar
          canSubmit={plan.canSubmit}
          submitting={mutations.submit.isLoading}
          resubmit={returned}
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

      {composerNode}

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
 * The plan ledger: one bordered surface holding strong objective rows, with the count and the single
 * add affordance in its header. Authoring actions live per-row behind an overflow menu; a submitted or
 * locked plan renders the same rows without them.
 */
function ObjectiveLedger({
  plan,
  targets,
  onAdd,
  onEdit,
  onRemove,
  onOpenProgress,
}: {
  plan: EmployeePlanDto;
  targets: AlignmentTargetDto[];
  onAdd: () => void;
  onEdit: (objective: PlanObjectiveDto) => void;
  onRemove: (objectiveId: string) => void;
  onOpenProgress: (objectiveId: string) => void;
}) {
  const [detailId, setDetailId] = useState<string | null>(null);

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
    <section className="rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="type-eyebrow text-muted-foreground">Your objectives</span>
          <span className="text-xs tabular-nums text-muted-foreground">{plan.objectives.length}</span>
        </div>
        {plan.canAuthor ? (
          <Button variant="outline" size="sm" onClick={onAdd}>
            <Plus className="size-4" data-icon="inline-start" /> Add objective
          </Button>
        ) : null}
      </div>

      {plan.objectives.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
          No objectives yet. Add the first one to start building your plan.
        </div>
      ) : (
        <div className="space-y-3 p-4">
          {plan.objectives.map((objective, index) => (
            <PlanObjectiveRow
              key={objective.id}
              index={index}
              objective={objective}
              alignmentScope={scopeFor(objective)}
              showProgress={plan.isLocked}
              active={detailId === objective.id}
              onEdit={plan.canAuthor ? () => onEdit(objective) : undefined}
              onRemove={plan.canAuthor ? () => onRemove(objective.id) : undefined}
              onOpenProgress={plan.isLocked ? () => onOpenProgress(objective.id) : undefined}
              onViewDetails={() => setDetailId(objective.id)}
            />
          ))}
        </div>
      )}

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
 * The plan-level terminal action while authoring. Every objective edit already persists to the Draft,
 * so there is no separate save — the quiet "All changes saved" states that truth, and Submit is the one
 * dominant action, naming the reviewer it hands the agreement to.
 */
function PlanActionBar({
  canSubmit,
  submitting,
  resubmit,
  onSubmit,
}: {
  canSubmit: boolean;
  submitting: boolean;
  resubmit: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4">
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Check className="size-4 text-success" aria-hidden />
        All changes saved
      </span>
      <AsyncButton size="lg" pending={submitting} disabled={!canSubmit} onClick={onSubmit}>
        {resubmit ? "Resubmit plan for review" : "Submit plan for review"}
      </AsyncButton>
    </div>
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
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <MessageSquareQuote className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="type-eyebrow text-muted-foreground">Reviewer feedback</p>
          <p className="mt-0.5 text-base font-semibold tracking-tight text-foreground">Changes requested</p>
        </div>
      </div>

      <div className="mt-3.5 flex items-center gap-2.5">
        <Avatar className="size-6">
          <AvatarFallback className="text-[0.625rem]">{initials(reviewer)}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 truncate text-sm font-medium text-foreground">{reviewer}</span>
        {at ? (
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">{formatDateTime(at)}</span>
        ) : null}
      </div>

      {feedback ? (
        <blockquote className="relative mt-4 rounded-xl bg-foreground/[0.06] py-3 pl-9 pr-4">
          <Quote className="absolute left-3.5 top-3 size-3.5 fill-current text-muted-foreground/40" aria-hidden />
          <p className="text-sm leading-relaxed text-foreground/80">{feedback}</p>
        </blockquote>
      ) : null}

      <p className="mt-4 text-sm text-muted-foreground">Revise your Plan and resubmit when ready.</p>
    </section>
  );
}

/**
 * The plan's snapshot: the allocation ring paired with the three facts that matter at a glance — how
 * many objectives, how much allocated, and when it was last touched. The ring reads allocation
 * honestly (amber while composing, green at exactly 100%, destructive when over), so the same card
 * serves the Draft being authored and the Submitted plan frozen as the record of what was sent. The
 * final fact adapts: the last-saved moment while it is a working Draft, the submission date once sent.
 */
function PlanSnapshot({ plan }: { plan: EmployeePlanDto }) {
  const total = plan.readiness.weightTotal;
  const count = plan.objectives.length;
  const submitted = plan.state === "Submitted";

  const tone = weightTone(total);
  const toneVar =
    tone === "success" ? "var(--success)" : tone === "danger" ? "var(--destructive)" : "var(--primary)";
  const centerClass =
    tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-foreground";

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="type-eyebrow text-muted-foreground">Plan snapshot</p>
      <div className="mt-4 flex items-center gap-5">
        <div className="shrink-0">
          <AllocationGauge
            value={total}
            tone={toneVar}
            centerValue={`${pct(total)}%`}
            centerLabel="allocated"
            centerClassName={cn("tabular-nums", centerClass)}
            height={124}
          />
        </div>
        <dl className="min-w-0 flex-1 space-y-3.5">
          <SnapshotFact icon={FileText} label={`${count} objective${count === 1 ? "" : "s"}`} />
          <SnapshotFact icon={Clock} label={`${pct(total)}% allocated`} />
          {submitted ? (
            <SnapshotFact
              icon={CalendarDays}
              label="Submitted"
              value={plan.submittedAt ? formatDate(plan.submittedAt.slice(0, 10)) : "—"}
            />
          ) : (
            <SnapshotFact icon={History} label="Last saved" value={formatDateTime(plan.lastSavedAt)} />
          )}
        </dl>
      </div>
    </section>
  );
}

function SnapshotFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <dt className="text-sm font-medium leading-tight text-foreground">{label}</dt>
        {value ? <dd className="mt-0.5 text-xs text-muted-foreground">{value}</dd> : null}
      </div>
    </div>
  );
}

/**
 * The not-started ledger: the objectives surface before a plan exists. A single document-and-plus mark
 * over the one dominant action, naming the Cycle and the reviewer who will hold the agreement. The
 * inspiration footer doubles as the quiet path to Organization Goals for those who can see it.
 */
function PlanNotStarted({
  cycleName,
  reviewerName,
  canViewOrgGoals,
  onStart,
}: {
  cycleName: string;
  reviewerName: string | null;
  canViewOrgGoals: boolean;
  onStart: () => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-5 py-3">
        <span className="type-eyebrow text-muted-foreground">Your objectives</span>
      </div>

      <div className="flex flex-col items-center px-6 py-14 text-center">
        <span className="relative mb-6 flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <FileText className="size-8" strokeWidth={1.5} aria-hidden />
          <span className="absolute -bottom-1.5 -right-1.5 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-card">
            <Plus className="size-4" aria-hidden />
          </span>
        </span>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Your {cycleName} plan hasn&apos;t been started yet.
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Build a set of measurable objectives for the Cycle.
          {reviewerName ? ` Your completed plan will be reviewed by ${reviewerName}.` : ""}
        </p>
        <Button size="lg" onClick={onStart} className="mt-6">
          Start my plan
        </Button>
      </div>

      {canViewOrgGoals ? (
        <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Need inspiration?</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Review your organizational goals or past objectives to get started.
              </p>
            </div>
          </div>
          <GoalsTextLink />
        </div>
      ) : null}
    </section>
  );
}

/** The zero-state snapshot: the same card as an authored plan, its ring empty and its facts at zero. */
function PlanSnapshotEmpty() {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="type-eyebrow text-muted-foreground">Plan snapshot</p>
      <div className="mt-4 flex items-center gap-5">
        <div className="shrink-0">
          <AllocationGauge
            value={0}
            tone="var(--muted-foreground)"
            centerValue="0%"
            centerLabel="allocated"
            centerClassName="tabular-nums text-muted-foreground"
            height={124}
          />
        </div>
        <dl className="min-w-0 flex-1 space-y-3.5">
          <SnapshotFact icon={FileText} label="0 objectives" />
          <SnapshotFact icon={Clock} label="0% allocated" />
          <SnapshotFact icon={CalendarDays} label="Not started" value="—" />
        </dl>
      </div>
    </section>
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
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="type-eyebrow text-muted-foreground">Next steps</p>
      <ol className="mt-4">
        {steps.map((step, index) => (
          <li key={step.title} className="relative flex gap-3 pb-5 last:pb-0">
            {index < steps.length - 1 ? (
              <span className="absolute left-3 top-7 bottom-0 w-px -translate-x-1/2 bg-border" aria-hidden />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                step.active
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground"
              )}
            >
              {index + 1}
            </span>
            <div className="min-w-0 pb-0.5">
              <p className="text-sm font-medium leading-tight text-foreground">{step.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{step.desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The quiet accent link into Organization Goals, matching the direction card's affordance. */
function GoalsTextLink() {
  return (
    <Link
      href="/goals"
      className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      View in Goals
      <ArrowUpRight className="size-3.5" aria-hidden />
    </Link>
  );
}

/**
 * Plan progress for a locked plan — one weighted meter, self-explanatory through the ledger beneath it
 * (each objective already shows its own progress and weight). No rainbow segments.
 */
function PlanProgressSummary({ plan }: { plan: EmployeePlanDto }) {
  const complete = plan.planProgress >= 100;
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="type-eyebrow text-muted-foreground">Plan progress</p>
          <p className={cn("mt-1 type-metric text-foreground", complete && "text-success")}>{pct(plan.planProgress)}%</p>
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
