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
      <div className="mx-auto max-w-md rounded-2xl border border-dashed p-10 text-center">
        <Inbox className="mx-auto size-6 text-muted-foreground" aria-hidden />
        <p className="mt-3 text-base font-medium">Nothing awaiting you</p>
        <p className="mt-1 text-sm text-muted-foreground">Submitted plans appear here when your reports send them for review.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="divide-y">
        {plans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => onOpen(plan.id)}
            className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40"
          >
            <Avatar className="size-9">
              <AvatarFallback className="text-xs">{initials(plan.employee.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{plan.employee.name ?? "Employee"}</p>
              <p className="truncate text-xs text-muted-foreground">{plan.orgUnitName ?? "No organizational unit"}</p>
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-sm tabular-nums">
                {plan.objectiveCount} objective{plan.objectiveCount === 1 ? "" : "s"}
              </p>
              <p className={cn("text-xs tabular-nums", plan.weightTotal === 100 ? "text-muted-foreground" : "text-warning")}>
                {pct(plan.weightTotal)}% weight
              </p>
            </div>
            {plan.submittedAt ? (
              <span className="hidden w-28 text-right text-xs text-muted-foreground md:block">
                {new Date(plan.submittedAt).toLocaleDateString()}
              </span>
            ) : null}
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}
