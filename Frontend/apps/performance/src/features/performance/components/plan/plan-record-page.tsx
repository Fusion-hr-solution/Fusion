"use client";

import { PageContainer, PagePermissionNotice } from "@repo/ds/shell";
import { useCycle, usePlanDetail } from "../../api/use-performance";
import { useWorkspaceContext } from "../../api/use-workspace";
import { performanceFailure } from "../../api/performance-failure";
import { ContentUnavailable } from "../content-unavailable";
import { MyPlanWorkspace } from "./my-plan-workspace";
import { PlanReview } from "./plan-review";
import { PlanPageSkeleton } from "./plan-skeleton";
import { useRecentRecord } from "@repo/api/react";

/**
 * One plan, addressed by its own Cycle. The owner sees their plan workspace for that Cycle; the
 * responsible reviewer and administrators see the same plan presented for a decision. What each may do
 * comes from the server's capabilities on the plan, never from this page.
 */
export function PlanRecordPage({ cycleId, planId }: { cycleId: string; planId: string }) {
  const context = useWorkspaceContext();
  const canRead = Boolean(context.data);
  const cycle = useCycle(canRead ? cycleId : null);
  const plan = usePlanDetail(canRead ? cycleId : null, planId);
  // Someone else's plan is a record people return to; your own lives at My Plan.
  useRecentRecord(
    "performance",
    plan.data && !plan.data.isOwner
      ? {
          label: plan.data.employee.name ? `${plan.data.employee.name}'s plan` : "Plan",
          kind: `${plan.data.cycleName} plan`,
          href: `/performance/cycles/${cycleId}/plans/${planId}`,
        }
      : null,
  );

  if (context.isLoading || (canRead && (cycle.isLoading || plan.isLoading))) return <PlanPageSkeleton />;
  if (context.error || performanceFailure(cycle.error).unavailable || performanceFailure(plan.error).unavailable) {
    return (
      <PageContainer>
        <PagePermissionNotice title="Plan unavailable" />
      </PageContainer>
    );
  }
  if (cycle.error) return <ContentUnavailable error={cycle.error} onRetry={cycle.refetch} subject="The Cycle" />;
  if (!cycle.data) return <PlanPageSkeleton />;

  if (plan.data?.isOwner) {
    return <MyPlanWorkspace cycle={cycle.data.cycle} />;
  }

  return (
    <PageContainer className="max-w-7xl">
      <PlanReview cycle={cycle.data.cycle} planId={planId} />
    </PageContainer>
  );
}
