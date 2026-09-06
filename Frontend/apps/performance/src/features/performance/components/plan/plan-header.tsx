"use client";

import { Info } from "lucide-react";
import type { EmployeePlanDto } from "@repo/api";
import { StatusBadge } from "@repo/ds/shell";
import { Avatar, AvatarFallback } from "@repo/ds/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@repo/ds/components/ui/tooltip";
import { initials } from "./plan-lib";

/**
 * The plan's lifecycle state as a chip beside the page title. Draft is a quiet accent outline — the
 * plan is yours to shape, not a warning — while a submitted or approved plan takes the semantic tone.
 */
export function PlanStateBadge({ plan }: { plan: EmployeePlanDto }) {
  if (plan.state === "Draft") {
    return (
      <span className="inline-flex items-center rounded-full border border-primary/50 px-2.5 py-0.5 text-xs font-semibold text-primary">
        Draft
      </span>
    );
  }
  return (
    <StatusBadge tone={plan.state === "Submitted" ? "warning" : "success"} dot>
      {plan.state === "Submitted" ? "Submitted" : "Approved"}
    </StatusBadge>
  );
}

/** The not-started state as a quiet neutral chip, before any plan exists to carry a lifecycle tone. */
export function NotStartedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground/50" aria-hidden />
      Not started
    </span>
  );
}

/**
 * The reviewer who holds this plan's agreement, as plan metadata sitting with the page title. The
 * reviewer is fixed from the cycle participant baseline — shown, never re-resolved here — so the info
 * affordance states that provenance rather than implying it tracks current manager data.
 */
export function PlanReviewerCard({ plan }: { plan: EmployeePlanDto }) {
  const reviewer = plan.responsibleManager?.name ?? "your manager";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5">
      <Avatar className="size-9">
        <AvatarFallback className="text-xs">{initials(reviewer)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="type-eyebrow text-muted-foreground">Reviewer</p>
        <p className="truncate text-sm font-semibold text-foreground">{reviewer}</p>
      </div>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="ml-1 shrink-0 rounded-full text-muted-foreground/50 transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="About your reviewer"
            >
              <Info className="size-4" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent>Set from your cycle participant record.</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
