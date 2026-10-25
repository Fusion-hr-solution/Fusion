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

  return (
    <PageContainer width="wide">
      <MyPlan
        cycle={cycle}
        heading={(actions) => (
          <PerformancePageHeading
            className="mb-6"
            title="My Plan"
            status={
              plan && plan.objectives.length > 0 ? <PlanStateBadge plan={plan} /> : planState.data ? <NotStartedBadge /> : null
            }
            actions={actions}
          />
        )}
      />
    </PageContainer>
  );
}
