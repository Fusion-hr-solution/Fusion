"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Lock } from "@/lib/icons";
import type { AlignmentTargetDto, EmployeePlanDto, PlanChangeRequestDto, PlanDecisionDto } from "@repo/api";
import { Avatar, AvatarFallback } from "@repo/ds/components/ui/avatar";
import { cn } from "@repo/ds/lib/utils";
import { formatDate, formatDateTime } from "../../lib";
import { PlanApprovedStatus } from "./plan-approved-status";
import { PlanDirectionSection, PlanReviewerSection, type DirectionLevel } from "./plan-direction";
import { SidebarSection } from "./plan-layout";
import { initials } from "./plan-lib";
import { PlanProgressCard } from "./plan-progress-card";
import { PlanSubmissionChecks } from "./plan-submission-checks";

/**
 * The plan's side panel (D-08): the same four sections, in the same order, in every state and for every
 * viewer — Status, Plan progress, Reviewer, Direction. Only what each section says changes with the state:
 * Status walks Draft → In review → Approved with that step's facts (the checks while drafting, the
 * reviewer's note and the change requests once returned, who is reviewing, who approved); Plan progress
 * says it hasn't started until the plan is approved.
 */
export function PlanRail({
  plan,
  lens,
  targets,
  reviewer,
  planningDeadline,
  directionLevels,
  subjectFirstName,
}: {
  /** Null before the participant starts a plan. */
  plan: EmployeePlanDto | null;
  /** "owner" reads their own plan; "reviewer" is the responsible reviewer or an administrator. */
  lens: "owner" | "reviewer";
  targets: AlignmentTargetDto[];
  reviewer: { id: string | null; name: string | null };
  planningDeadline: string;
  directionLevels?: DirectionLevel[];
  subjectFirstName?: string;
}) {
  return (
    <>
      <SidebarSection label="Status">
        <div className="mt-4">
          <StatusBody plan={plan} lens={lens} reviewerName={reviewer.name} planningDeadline={planningDeadline} subjectFirstName={subjectFirstName} />
        </div>
      </SidebarSection>
      {plan?.isLocked ? (
        <PlanProgressCard plan={plan} emptyDescription={lens === "owner" ? "Plan progress begins once you update your objectives." : undefined} />
      ) : (
        <SidebarSection label="Plan progress">
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="text-base leading-none" aria-hidden>—</span> Starts once the plan is approved
          </p>
        </SidebarSection>
      )}
      {/* Who reviews; what they decided is the Status section's to say. */}
      <PlanReviewerSection reviewerId={reviewer.id} reviewerName={reviewer.name} />
      <PlanDirectionSection
        cycleId={plan?.cycleId ?? ""}
        objectives={plan?.objectives ?? []}
        targets={targets}
        directionLevels={directionLevels}
      />
    </>
  );
}

/** The latest return while the plan is back in Draft because of it. */
export function activeReturn(plan: EmployeePlanDto | null): PlanDecisionDto | null {
  if (!plan || plan.state !== "Draft") return null;
  const last = plan.history.at(-1);
  return last?.kind === "Returned" ? last : null;
}

/** The latest return of all, which a resubmitted plan answers. */
export function latestReturn(plan: EmployeePlanDto | null): PlanDecisionDto | null {
  return [...(plan?.history ?? [])].reverse().find((h) => h.kind === "Returned") ?? null;
}

function StatusBody({
  plan,
  lens,
  reviewerName,
  planningDeadline,
  subjectFirstName,
}: {
  plan: EmployeePlanDto | null;
  lens: "owner" | "reviewer";
  reviewerName: string | null;
  planningDeadline: string;
  subjectFirstName?: string;
}) {
  if (plan?.isLocked) return <PlanApprovedStatus plan={plan} perspective={lens} subjectFirstName={subjectFirstName} />;

  const returned = activeReturn(plan);
  const submitted = plan?.state === "Submitted";
  const reviewer = reviewerName ?? "your reviewer";
  const who = subjectFirstName ?? "They";
  const submittedOn = plan?.submittedAt ? formatDate(plan.submittedAt.slice(0, 10)) : null;

  const steps: StatusStep[] = [
    submitted
      ? { key: "draft", label: "Submitted", inlineDetail: submittedOn, tone: "done" }
      : returned
        ? { key: "draft", label: "Returned for changes", inlineDetail: formatDate(returned.decidedAt.slice(0, 10)), tone: "returned" }
        : {
            key: "draft",
            label: plan ? "Draft" : "Not started",
            detail: <>Due <span className="font-medium text-foreground">{formatDate(planningDeadline)}</span></>,
            tone: "current",
          },
    submitted
      ? {
          key: "review",
          label: "In review",
          detail: lens === "reviewer" && plan?.canDecide ? "Waiting for your decision" : <><span className="font-medium text-foreground">{reviewer}</span> is reviewing</>,
          tone: "current",
        }
      : { key: "review", label: "In review", tone: "upcoming" },
    { key: "approved", label: "Approved", tone: "upcoming" },
  ];

  const resubmission = submitted ? latestReturn(plan) : null;
  const answered = resubmission?.changeRequests ?? [];

  return (
    <div className="space-y-4">
      <ol>
        {steps.map((step, index) => (
          <Step key={step.key} step={step} last={index === steps.length - 1} />
        ))}
      </ol>

      {returned ? (
        <ReturnNote decision={returned} lens={lens} subjectFirstName={subjectFirstName} revisedAt={revisedSince(plan, returned)} />
      ) : null}

      {lens === "owner" && plan?.state === "Draft" ? <PlanSubmissionChecks readiness={plan.readiness} bare /> : null}

      {submitted && lens === "owner" ? (
        <p className="flex items-start gap-2.5 border-t border-border pt-4 text-sm font-medium text-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden /> Read-only while in review
        </p>
      ) : null}

      {submitted && answered.length > 0 ? (
        <ResubmissionOutcome requests={answered} who={lens === "owner" ? "You" : who} />
      ) : null}
    </div>
  );
}

/** Edited after the reviewer sent it back (the return itself stamps the plan, so allow it a moment). */
function revisedSince(plan: EmployeePlanDto | null, returned: PlanDecisionDto): string | null {
  if (!plan) return null;
  return Date.parse(plan.lastSavedAt) - Date.parse(returned.decidedAt) > 2000 ? plan.lastSavedAt : null;
}

/** The reviewer's note as their speech, and how many of their change requests are addressed. */
function ReturnNote({
  decision,
  lens,
  subjectFirstName,
  revisedAt,
}: {
  decision: PlanDecisionDto;
  lens: "owner" | "reviewer";
  subjectFirstName?: string;
  revisedAt: string | null;
}) {
  const reviewer = decision.actorName ?? "Your reviewer";
  const total = decision.changeRequests.length;
  const addressed = decision.changeRequests.filter((r) => r.state !== "Open").length;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Avatar className="size-8">
          <AvatarFallback className="text-[0.6875rem]">{initials(reviewer)}</AvatarFallback>
        </Avatar>
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          <span className="font-medium text-foreground/85">{lens === "reviewer" ? "You" : reviewer}</span>
          <span aria-hidden> · </span>
          <time dateTime={decision.decidedAt} className="tabular-nums">{formatDateTime(decision.decidedAt)}</time>
        </p>
      </div>
      {decision.feedback ? (
        <blockquote className="relative rounded-control border border-border bg-inlay px-4 py-3.5 shadow-raised">
          <span className="absolute -top-[7px] inset-s-[10px] size-3 rotate-45 rounded-ss-detail border-s border-t border-border bg-inlay" aria-hidden />
          <ClampedText text={decision.feedback} />
        </blockquote>
      ) : null}
      {total > 0 ? (
        <p
          className={cn(
            "flex items-center gap-2 rounded-control-sm px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset",
            addressed === total ? "bg-info/10 text-info ring-info/25" : "bg-primary-tint text-primary-ink ring-primary-ring"
          )}
        >
          <Check className="size-3.5 shrink-0" aria-hidden />
          {addressed} of {total} change{total === 1 ? "" : "s"} addressed
          {lens === "reviewer" && subjectFirstName ? ` by ${subjectFirstName}` : ""}
        </p>
      ) : revisedAt ? (
        <p className="flex items-center gap-2 rounded-control-sm bg-info/10 px-2.5 py-1.5 text-xs font-medium text-info ring-1 ring-inset ring-info/25">
          <Check className="size-3.5 shrink-0" aria-hidden />
          Revised <time dateTime={revisedAt} className="tabular-nums">{formatDateTime(revisedAt)}</time>
        </p>
      ) : null}
    </div>
  );
}

/** A resubmitted plan answers its return: how many changes were made, and requests whose objective is gone. */
function ResubmissionOutcome({ requests, who }: { requests: PlanChangeRequestDto[]; who: string }) {
  const removed = requests.filter((r) => r.state === "ObjectiveRemoved");
  const addressed = requests.filter((r) => r.state !== "Open").length;
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <p className="text-sm font-medium text-foreground">
        {who} addressed {addressed} of {requests.length} change{requests.length === 1 ? "" : "s"}
      </p>
      {removed.length > 0 ? (
        <ul className="space-y-2.5">
          {removed.map((request) => (
            <li key={request.id} className="text-xs">
              <p className="font-medium text-foreground">{request.objectiveTitle}</p>
              <p className="mt-0.5 text-muted-foreground">Objective removed · &ldquo;{request.text}&rdquo;</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ── The step track ───────────────────────────────────────────────────────────

type StepTone = "done" | "current" | "returned" | "upcoming";

interface StatusStep {
  key: string;
  label: string;
  detail?: ReactNode;
  inlineDetail?: ReactNode;
  tone: StepTone;
}

function Step({ step, last }: { step: StatusStep; last: boolean }) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!last ? (
        <span
          className={cn("absolute bottom-0 inset-s-2.5 top-6 w-px -translate-x-1/2 rtl:translate-x-1/2", step.tone === "done" ? "bg-success/40" : "bg-border")}
          aria-hidden
        />
      ) : null}
      <Marker tone={step.tone} />
      <div className="min-w-0 pb-0.5">
        <div className="flex items-baseline gap-2">
          <p
            className={cn(
              "text-sm leading-tight",
              step.tone === "current"
                ? "font-semibold text-foreground"
                : step.tone === "returned"
                  ? "font-semibold text-warning"
                  : step.tone === "done"
                    ? "font-medium text-foreground"
                    : "font-medium text-muted-foreground"
            )}
          >
            {step.label}
          </p>
          {step.inlineDetail ? <span className="text-xs text-muted-foreground">{step.inlineDetail}</span> : null}
        </div>
        {step.detail ? <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p> : null}
      </div>
    </li>
  );
}

function Marker({ tone }: { tone: StepTone }) {
  if (tone === "done") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-white">
        <Check className="size-3" aria-hidden />
      </span>
    );
  }
  if (tone === "current") {
    return (
      <span className="relative flex size-5 shrink-0 items-center justify-center">
        <span className="relative size-2.5 rounded-full bg-primary ring-4 ring-primary/12" />
      </span>
    );
  }
  if (tone === "returned") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-warning/15 ring-4 ring-warning/10">
        <span className="size-2.5 rounded-full bg-warning" />
      </span>
    );
  }
  return (
    <span className="flex size-5 shrink-0 items-center justify-center">
      <span className="size-3 rounded-full border-2 border-muted-foreground/30" />
    </span>
  );
}

/** Long text held to a short preview that fades out, with a toggle only when it actually overflows. */
function ClampedText({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  const clipped = overflows && !expanded;
  return (
    <div>
      <div
        ref={ref}
        className={cn(
          "space-y-2.5 text-sm leading-relaxed text-foreground/85",
          !expanded && "max-h-[7.25rem] overflow-hidden",
          clipped && "[mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
        )}
      >
        {paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-line break-words">{p}</p>
        ))}
      </div>
      {overflows || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-0.5 inline-flex items-center gap-1 rounded-detail text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? "Show less" : "Read more"}
          <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
