"use client";

import { Check } from "lucide-react";
import type { EmployeePlanDto } from "@repo/api";
import { formatDate } from "../../lib";
import { PlanBannerMark } from "./plan-banner";

/**
 * The approved, locked plan stated once — the same card whether the plan's owner or its reviewer reads
 * it, since both are looking at the same settled agreement. It leads with the outcome and keeps only the
 * facts that still matter once execution is underway: who approved it and when, and how many objectives it
 * holds. Allocation is deliberately absent — a plan cannot be approved unless it is fully allocated, so
 * restating "100%" here would carry no information. The owner and reviewer differ only in the one sentence
 * that names the perspective; the structure is identical.
 */
export function PlanApprovedStatus({
  plan,
  perspective,
  subjectFirstName,
}: {
  plan: EmployeePlanDto;
  /** "owner" reads their own plan; "reviewer" reads the plan they approved. */
  perspective: "owner" | "reviewer";
  /** The plan owner's first name — used only in the reviewer's sentence. */
  subjectFirstName?: string;
}) {
  const approval = [...plan.history]
    .reverse()
    .find((h) => h.kind === "Approved" || h.kind === "ApprovedExceptionally");
  const approver = approval?.actorName ?? plan.responsibleManager?.name ?? null;
  const approvedOn = plan.approvedAt ? formatDate(plan.approvedAt.slice(0, 10)) : null;
  const count = plan.objectives.length;

  const detail =
    perspective === "reviewer"
      ? `You approved ${subjectFirstName ? `${subjectFirstName}'s` : "this"} plan. It is now the locked baseline.`
      : approver
        ? `Approved by ${approver}. This is now your locked baseline.`
        : "This is now your locked baseline.";

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3.5">
        <PlanBannerMark className="text-success bg-success/12 ring-success/20">
          <Check className="size-5" aria-hidden />
        </PlanBannerMark>
        <div className="min-w-0">
          <p className="font-semibold tracking-tight text-foreground">Approved &amp; locked</p>
          <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{detail}</p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
        <Fact label="Approved" value={approvedOn ?? "—"} />
        <Fact label="Objectives" value={String(count)} />
      </dl>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="type-eyebrow text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
