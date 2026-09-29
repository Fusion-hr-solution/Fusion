"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  FileText,
  History,
  BarChart3,
  MessageSquareQuote,
  Plus,
  Quote,
  Send,
  Share2,
  Target,
  User,
  Users,
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
import { AllocationGauge, AsyncButton, PageError } from "@repo/ds/shell";
import { PlanSurfaceSkeleton } from "./plan-skeleton";
import { OrgObjectiveDetailDrawer } from "../goals/org-objective-detail-drawer";
import { cn } from "@repo/ds/lib/utils";
import {
  useAlignmentTargets,
  useMyPlan,
  usePerformanceAccess,
  usePlanMutations,
} from "../../api/use-performance";
import { formatDate, formatDateTime } from "../../lib";
import { PlanDirection, directionFromTargets } from "./plan-direction";
import { PlanGoalComposer } from "./goal-composer";
import { ObjectiveDetailDrawer } from "./objective-detail-drawer";
import { PlanObjectiveRow } from "./plan-objective-row";
import { PlanSubmissionChecks } from "./plan-submission-checks";
import { PlanSubmissionStatus } from "./plan-submission-status";
import { initials, pct, weightTone } from "./plan-lib";
import { PlanProgressCard } from "./plan-progress-card";
import { PlanApprovedStatus } from "./plan-approved-status";

export function MyPlan({ cycle }: { cycle: CycleSummaryDto }) {
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

  if (state.isLoading) return <PlanSurfaceSkeleton />;
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
      <div className="space-y-4">
        <PlanDirection
          objectives={[]}
          targets={targets}
          directionLevels={directionLevels}
          reviewerName={reviewerName}
          canViewOrgGoals={canViewOrgGoals}
        />

        {/* Both columns stretch to one height so the ledger and the rail share a bottom edge. */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <PlanNotStarted
            cycleName={cycle.name}
            onStart={() => setComposer({})}
          />
          <aside className="flex flex-col gap-4">
            <PlanSnapshotEmpty />
            <PlanNextSteps reviewerName={reviewerName} className="flex-1" />
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
      <PlanApprovedStatus plan={plan} perspective="owner" />
      <PlanProgressCard plan={plan} emptyDescription="Plan progress begins once you update your objectives." />
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

      {/* As in the empty state, both columns share one height: the ledger fills its cell and the rail's
          last card takes up the slack, so the two bottom edges meet. */}
      <div className={cn(rail && "grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]")}>
        <div className="flex flex-col gap-4">
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
          {isAuthor ? (
            <PlanActionBar
              canSubmit={plan.canSubmit}
              submitting={mutations.submit.isLoading}
              resubmit={returned}
              reviewerName={reviewerName}
              objectiveCount={plan.objectives.length}
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
          ) : null}
        </div>

        {rail ? <aside className="flex flex-col gap-4 [&>*:last-child]:flex-1">{rail}</aside> : null}
      </div>

      {composerNode}
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
    <section className="flex-1 rounded-surface border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="type-eyebrow text-muted-foreground">Your objectives</span>
          <span className="text-xs tabular-nums text-muted-foreground">{plan.objectives.length}</span>
        </div>
        {plan.canAuthor ? (
          <Button
            size="sm"
            onClick={onAdd}
            className="bg-foreground text-background hover:bg-foreground/90"
          >
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
  reviewerName,
  objectiveCount,
  onSubmit,
}: {
  canSubmit: boolean;
  submitting: boolean;
  resubmit: boolean;
  reviewerName: string | null;
  objectiveCount: number;
  onSubmit: () => Promise<boolean>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const label = resubmit ? "Resubmit plan for review" : "Submit plan for review";
  const reviewer = reviewerName ?? "your reviewer";
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-surface border border-border bg-card px-5 py-4">
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Check className="size-4 text-success" aria-hidden />
        All changes saved
      </span>
      <AlertDialog open={confirmOpen} onOpenChange={(o) => { if (!submitting) setConfirmOpen(o); }}>
        <AlertDialogTrigger asChild>
          <Button size="lg" disabled={!canSubmit}>
            <Send className="size-4" data-icon="inline-start" /> {label}
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
    <section className="rounded-surface border border-border bg-card p-5">
      <div className="flex items-start gap-3.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary ring-1 ring-primary/20">
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
        <blockquote className="relative mt-4 rounded-surface bg-foreground/[0.06] py-3 pl-9 pr-4">
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
    <section className="rounded-surface border border-border bg-card p-5">
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
  icon: typeof FileText;
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
  onStart,
}: {
  cycleName: string;
  onStart: () => void;
}) {
  return (
    <section className="flex flex-col rounded-surface border border-border bg-card">
      <div className="border-b border-border px-5 py-3">
        <span className="type-eyebrow text-muted-foreground">Your objectives</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
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
    </section>
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

/** The zero-state snapshot: the same card as an authored plan, its ring empty and its facts at zero. */
function PlanSnapshotEmpty() {
  return (
    <section className="rounded-surface border border-border bg-card p-5">
      <p className="type-eyebrow text-muted-foreground">Plan snapshot</p>
      <div className="mt-5 flex items-center gap-5">
        <div className="shrink-0">
          <AllocationGauge
            value={0}
            tone="var(--muted-foreground)"
            centerValue="0%"
            centerLabel="allocated"
            centerClassName="tabular-nums text-muted-foreground"
            height={144}
          />
        </div>
        <dl className="min-w-0 flex-1 space-y-5">
          <SnapshotFact icon={FileText} label="0 objectives" />
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
function PlanNextSteps({
  reviewerName,
  className,
}: {
  reviewerName: string | null;
  className?: string;
}) {
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
    <section className={cn("flex flex-col rounded-surface border border-border bg-card p-5", className)}>
      <p className="type-eyebrow text-muted-foreground">Next steps</p>
      {/* Steps share the card's spare height, so the rail spans the column instead of pooling at the top. */}
      <ol className="mt-5 flex flex-1 flex-col">
        {steps.map((step, index) => (
          <li key={step.title} className="relative flex min-h-20 flex-1 gap-3.5 last:min-h-0 last:flex-none">
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
    </section>
  );
}

