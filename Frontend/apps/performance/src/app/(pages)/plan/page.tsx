"use client";

import { PageContainer, PagePermissionNotice } from "@repo/ds/shell";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { PlanPageSkeleton } from "@/features/performance/components/plan/plan-skeleton";
import { MyPlanWorkspace } from "@/features/performance/components/plan/my-plan-workspace";
import { useCurrentCycle } from "@/features/performance/api/use-performance";
import { useWorkspaceContext } from "@/features/performance/api/use-workspace";
import { performanceFailure } from "@/features/performance/api/performance-failure";

export default function PlanPage() {
  const context = useWorkspaceContext();
  // My Plan belongs to participants of the selected Cycle, as Performance recorded them.
  const canParticipate = context.data?.destinations.myPlan ?? false;

  const detail = useCurrentCycle(canParticipate);
  const cycle = detail.data?.cycle ?? null;

  if (context.isLoading) return <PlanPageSkeleton empty />;
  if (context.error && !performanceFailure(context.error).unavailable) return <ContentUnavailable error={context.error} onRetry={context.refetch} subject="Performance workspace" />;
  if (context.error) return <PagePermissionNotice title="No plan for your account" description="A performance plan is available to employees included in an active cycle." />;
  if (!canParticipate) {
    return (
      <PagePermissionNotice
        title="No plan for your account"
        description="A performance plan is available to employees included in an active cycle."
      />
    );
  }
  if (detail.isLoading) return <PlanPageSkeleton empty />;
  if (detail.error) return <ContentUnavailable error={detail.error} onRetry={detail.refetch} subject="The Cycle" />;
  // Planning opens at activation: a Cycle still in setup has no plan to author yet.
  if (!cycle || cycle.state === "Draft") {
    return (
      <PageContainer>
        <PagePermissionNotice
          title="No cycle yet"
          description="Your plan opens once your organization activates a performance cycle."
        />
      </PageContainer>
    );
  }

  return <MyPlanWorkspace cycle={cycle} enabled={canParticipate} />;
}
