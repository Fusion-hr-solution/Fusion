"use client";

import { PageContainer, PagePermissionNotice, PageSkeleton } from "@repo/ds/shell";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { CycleWorkspaceHeader } from "@/features/performance/components/cycle-workspace-header";
import { MyPlan } from "@/features/performance/components/plan/my-plan";
import { usePerformanceAccess, useCurrentCycle, useCycles } from "@/features/performance/api/use-performance";

export default function PlanPage() {
  const access = usePerformanceAccess();
  const canParticipate = access.data?.canParticipate ?? false;
  const canEnter = access.data?.canEnter ?? false;

  const detail = useCurrentCycle(canEnter);
  const cycles = useCycles(canEnter);
  const cycle = detail.data?.cycle ?? null;

  if (access.isLoading) return <PageSkeleton rows={4} label="Loading Performance" />;
  if (!canParticipate) {
    return (
      <PagePermissionNotice
        title="No plan for your account"
        description="A performance plan is available to employees included in an active cycle."
      />
    );
  }
  if (detail.isLoading) return <PageSkeleton rows={4} label="Loading Cycle" />;
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

  return (
    <PageContainer>
      <div className="space-y-8">
        <CycleWorkspaceHeader cycle={cycle} cycles={cycles.data} onSelectCycle={() => undefined} />
        <MyPlan cycle={cycle} />
      </div>
    </PageContainer>
  );
}
