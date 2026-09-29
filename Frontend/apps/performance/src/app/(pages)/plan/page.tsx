"use client";

import { PageContainer, PagePermissionNotice } from "@repo/ds/shell";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { PerformancePageHeading } from "@/features/performance/components/performance-page-heading";
import { PlanPageSkeleton } from "@/features/performance/components/plan/plan-skeleton";
import { MyPlan } from "@/features/performance/components/plan/my-plan";
import { NotStartedBadge, PlanStateBadge } from "@/features/performance/components/plan/plan-header";
import { usePerformanceAccess, useCurrentCycle, useMyPlan } from "@/features/performance/api/use-performance";

export default function PlanPage() {
  const access = usePerformanceAccess();
  const canParticipate = access.data?.canParticipate ?? false;
  const canEnter = access.data?.canEnter ?? false;

  const detail = useCurrentCycle(canEnter);
  const cycle = detail.data?.cycle ?? null;

  // Read the plan here too (same query key as MyPlan — deduped) so the agreement state can sit with
  // the page title as heading metadata rather than as a separate row below it.
  const planState = useMyPlan(cycle?.id ?? null, canParticipate);
  const plan = planState.data?.plan ?? null;

  if (access.isLoading) return <PlanPageSkeleton />;
  if (!canParticipate) {
    return (
      <PagePermissionNotice
        title="No plan for your account"
        description="A performance plan is available to employees included in an active cycle."
      />
    );
  }
  if (detail.isLoading) return <PlanPageSkeleton />;
  if (detail.error) return <ContentUnavailable error={detail.error} onRetry={detail.refetch} subject="The Cycle" />;
  if (!cycle) {
    return (
      <PageContainer>
        <PagePermissionNotice
          title="No cycle yet"
          description="Your plan opens once your organization activates a performance cycle."
        />
      </PageContainer>
    );
  }

  // Once the plan is approved and locked, the surface has moved from planning to execution, and the page
  // subtitle follows.
  const executing = plan?.isLocked ?? false;

  return (
    <PageContainer className="max-w-7xl">
      <PerformancePageHeading
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
      />
      <MyPlan cycle={cycle} />
    </PageContainer>
  );
}
