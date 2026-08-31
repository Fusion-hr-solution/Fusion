"use client";

import { ChevronRight, Inbox } from "lucide-react";
import type { PlanReviewSummaryDto } from "@repo/api";
import { Avatar, AvatarFallback } from "@repo/ds/components/ui/avatar";
import { cn } from "@repo/ds/lib/utils";
import { initials, pct } from "./plan-lib";

/**
 * The review queue — submitted plans awaiting this manager's decision, ordered oldest first so the
 * longest-waiting agreement surfaces first. Each row is scannable (who, plan shape, when) and opens
 * the decision workspace. Not a table: the person leads, the plan shape is secondary context.
 */
export function PlanReviewQueue({
  plans,
  onOpen,
}: {
  plans: PlanReviewSummaryDto[];
  onOpen: (planId: string) => void;
}) {
  if (plans.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Inbox className="size-4" aria-hidden />
        Submitted plans appear here when your reports send them for review.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="divide-y divide-border">
        {plans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => onOpen(plan.id)}
            className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40"
          >
            <Avatar className="size-10">
              <AvatarFallback className="text-xs">{initials(plan.employee.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{plan.employee.name ?? "Employee"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {plan.orgUnitName ?? "No organizational unit"}
                <span aria-hidden> · </span>
                {plan.objectiveCount} objective{plan.objectiveCount === 1 ? "" : "s"}
                <span aria-hidden> · </span>
                <span className={cn("tabular-nums", plan.weightTotal === 100 ? "" : "text-warning")}>
                  {pct(plan.weightTotal)}% weight
                </span>
              </p>
            </div>
            {plan.submittedAt ? (
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                Submitted{" "}
                {new Date(plan.submittedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              </span>
            ) : null}
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
              Review
              <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
