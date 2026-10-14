"use client";

import type { CycleSummaryDto } from "@repo/api";
import { PageContainer } from "@repo/ds/shell";
import { useMyPlan } from "../../api/use-performance";
import { PerformancePageHeading } from "../performance-page-heading";
import { MyPlan } from "./my-plan";
import { NotStartedBadge, PlanStateBadge } from "./plan-header";

/**
 * The caller's own plan in one Cycle, with its agreement state beside the title. Shared by My Plan
 * (the selected Cycle) and the canonical plan address when its owner opens it.
 */
export function MyPlanWorkspace({ cycle, enabled = true }: { cycle: CycleSummaryDto; enabled?: boolean }) {
  // Same query key as MyPlan — deduped — so the agreement state can sit with the page title.
  const planState = useMyPlan(cycle.id, enabled);
  const plan = planState.data?.plan ?? null;
  // Once the plan is approved and locked, the surface has moved from planning to execution.
  const executing = plan?.isLocked ?? false;

  return (
    <PageContainer className="max-w-7xl">
      <MyPlan
        cycle={cycle}
        heading={(actions) => (
          <PerformancePageHeading
            className="mb-6"
            title={
              <span className="inline-flex flex-wrap items-center gap-2.5">
                My Plan
                {plan && plan.objectives.length > 0 ? (
                  <PlanStateBadge plan={plan} />
                ) : planState.data ? (
                  <NotStartedBadge />
                ) : null}
              </span>
            }
            description={executing ? "Execution & progress" : "Planning & Agreement"}
            actions={actions}
          />
        )}
      />
    </PageContainer>
  );
}
