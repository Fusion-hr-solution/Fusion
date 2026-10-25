"use client";

import { useAuth } from "@repo/auth";
import { Check } from "@/lib/icons";
import type { EmployeePlanDto } from "@repo/api";
import { formatDate } from "../../lib";
import { PlanBannerMark } from "./plan-banner";

/**
 * The approved, locked plan stated once — the same Status content whether the plan's owner or its reviewer reads
 * it, since both are looking at the same settled agreement. It leads with the outcome and keeps only the
 * facts that still matter once execution is underway: who approved it and when. The objective count
 * lives on the list heading beside it. Allocation is deliberately absent — a plan cannot be approved unless it is fully allocated, so
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
  const { user } = useAuth();
  const administrative = approval?.kind === "ApprovedExceptionally";
  // Only a normal approval can fall back to the reviewer's name: an administrative approval must never
  // read as the reviewer's (an administrator may have no employee record, so no resolved name).
  const approver = approval?.actorName ?? (administrative ? null : plan.responsibleManager?.name) ?? null;
  const approvedOn = plan.approvedAt ? formatDate(plan.approvedAt.slice(0, 10)) : null;
  const approvedByViewer = Boolean(user?.employeeId && approval?.actorEmployeeId === user.employeeId);
  const whose = subjectFirstName ? `${subjectFirstName}'s` : "this";
  const by = administrative
    ? approver ? `${approver} approved it as administrator` : "Approved by administration"
    : `Approved by ${approver}`;

  const detail =
    perspective === "reviewer"
      ? approvedByViewer
        ? `You approved ${whose} plan${administrative ? " as administrator" : ""}`
        : approver || administrative
          ? by
          : ""
      : approver || administrative
        ? by
        : "";

  return (
      <div className="flex items-start gap-3.5">
        <PlanBannerMark className="text-success bg-success/12 ring-success/20">
          <Check className="size-5" aria-hidden />
        </PlanBannerMark>
        <div className="min-w-0">
          <p className="flex flex-wrap items-baseline gap-x-2 font-semibold tracking-tight text-foreground">
            Approved &amp; locked
            {approvedOn && plan.approvedAt ? (
              <time dateTime={plan.approvedAt} className="text-xs font-normal tabular-nums text-muted-foreground">
                {approvedOn}
              </time>
            ) : null}
          </p>
          {detail ? <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{detail}</p> : null}
        </div>
      </div>
  );
}
