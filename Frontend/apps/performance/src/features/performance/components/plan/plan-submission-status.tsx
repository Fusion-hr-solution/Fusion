"use client";

import type { ReactNode } from "react";
import { Check, Lock } from "lucide-react";
import type { EmployeePlanDto } from "@repo/api";
import { cn } from "@repo/ds/lib/utils";
import { formatDate } from "../../lib";
import { pct } from "./plan-lib";

type StepTone = "done" | "current" | "returned" | "upcoming";

interface StatusStep {
  key: string;
  label: string;
  detail?: ReactNode;
  /** A quieter second line beneath the detail (e.g. what was submitted). */
  subDetail?: ReactNode;
  tone: StepTone;
}

/** Emphasize a key value inside otherwise-quiet detail copy. */
function Key({ children }: { children: ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>;
}

/**
 * Where a submitted Plan stands right now — the handoff from the employee to their reviewer, as a
 * three-step timeline, not a workflow engine. It answers "what is happening with my Plan?" in one
 * glance: the submission is done, the review is in progress with the named reviewer, and a decision
 * is still to come. Once the reviewer acts it resolves to the returned or the approved-and-locked
 * outcome. The current step carries the emphasis; done steps read as quiet success; the future step
 * stays neutral. Feedback for a returned Plan lives with the Plan, not here.
 */
export function PlanSubmissionStatus({ plan }: { plan: EmployeePlanDto }) {
  const reviewer = plan.responsibleManager?.name ?? "your reviewer";
  // submittedAt is a full ISO timestamp; formatDate speaks YYYY-MM-DD, so take the date part.
  const submittedOn = plan.submittedAt
    ? formatDate(plan.submittedAt.slice(0, 10))
    : null;
  const returned =
    plan.state === "Draft" && plan.history.some((h) => h.kind === "Returned");
  const approved = plan.state === "Approved";
  const reviewDone = approved || returned;
  const awaiting = plan.state === "Submitted";

  const count = plan.objectives.length;

  const steps: StatusStep[] = [
    {
      key: "submitted",
      label: "Plan submitted",
      detail: submittedOn ? <Key>{submittedOn}</Key> : null,
      subDetail: (
        <>
          <Key>{count}</Key> objective{count === 1 ? "" : "s"} ·{" "}
          <Key>{pct(plan.readiness.weightTotal)}% allocated</Key>
        </>
      ),
      tone: "done",
    },
    {
      key: "review",
      label: reviewDone ? "Review completed" : "Under review",
      detail: reviewDone ? null : (
        <>
          <Key>{reviewer}</Key> is reviewing your plan.
        </>
      ),
      tone: reviewDone ? "done" : "current",
    },
    approved
      ? {
          key: "decision",
          label: "Approved & locked",
          detail: `Your ${plan.cycleName} plan is now finalized.`,
          tone: "done",
        }
      : returned
        ? {
            key: "decision",
            label: "Returned for changes",
            detail: `${reviewer} requested updates.`,
            tone: "returned",
          }
        : {
            key: "decision",
            label: "Decision",
            detail: "Awaiting reviewer decision.",
            tone: "upcoming",
          },
  ];

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="type-eyebrow text-muted-foreground">Submission status</p>
      <ol className="mt-4">
        {steps.map((step, index) => (
          <Step key={step.key} step={step} last={index === steps.length - 1} />
        ))}
      </ol>

      {awaiting ? (
        <div className="mt-1 flex items-start gap-3 border-t border-border pt-4">
          <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
            <Lock className="size-3.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight text-foreground">Your plan is read-only</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              You&apos;ll be notified once a decision is made.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Step({ step, last }: { step: StatusStep; last: boolean }) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {/* Connector runs the full gap to the next marker (absolute so pb-5 doesn't cut it short). */}
      {!last ? (
        <span
          className={cn(
            "absolute left-2.5 top-6 bottom-0 w-px -translate-x-1/2",
            step.tone === "done" ? "bg-success/40" : "bg-border"
          )}
          aria-hidden
        />
      ) : null}
      <Marker tone={step.tone} />
      <div className="min-w-0 pb-0.5">
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
        {step.detail ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p>
        ) : null}
        {step.subDetail ? (
          <p className="mt-0.5 text-xs text-muted-foreground/80">{step.subDetail}</p>
        ) : null}
      </div>
    </li>
  );
}

/** The rail marker: a filled success tick for done, a solid dot for the live step, a hollow ring ahead. */
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
        {/* Radar ping: the dot holds still while a filled pulse sweeps outward past it and loops. */}
        <span
          className="absolute inset-0 rounded-full bg-primary/40 animate-ping"
          style={{ animationDuration: "1.2s" }}
          aria-hidden
        />
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
