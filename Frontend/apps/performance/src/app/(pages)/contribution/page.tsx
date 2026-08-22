"use client";

import { PageContainer, PagePermissionNotice, PageSkeleton } from "@repo/ds/shell";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { CycleWorkspaceHeader } from "@/features/performance/components/cycle-workspace-header";
import { ContributionExplorer } from "@/features/performance/components/contribution/contribution-explorer";
import { usePerformanceAccess, useCurrentCycle, useCycles } from "@/features/performance/api/use-performance";

export default function ContributionPage() {
  const access = usePerformanceAccess();
  const canEnter = access.data?.canEnter ?? false;
  const scope = access.data?.aggregateViewScope ?? null;
  const canExplore =
    (access.data?.canAdminister ?? false) ||
    (access.data?.canPublishStrategy ?? false) ||
    scope === "DirectReports" ||
    scope === "OrgUnit" ||
    scope === "Tenant";

  const detail = useCurrentCycle(canEnter);
  const cycles = useCycles(canEnter);
  const cycle = detail.data?.cycle ?? null;

  if (access.isLoading) return <PageSkeleton rows={4} label="Loading Performance" />;
  if (!canExplore) {
    return (
      <PagePermissionNotice
        title="No contribution view"
        description="The Contribution Explorer is available to leadership and performance administration."
      />
    );
  }
  if (detail.isLoading) return <PageSkeleton rows={4} label="Loading Cycle" />;
  if (detail.error) return <ContentUnavailable error={detail.error} onRetry={detail.refetch} subject="The Cycle" />;
  if (!cycle) {
    return (
      <PageContainer>
        <PagePermissionNotice title="No cycle yet" description="Contribution opens once a cycle is active." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-8">
        <CycleWorkspaceHeader cycle={cycle} cycles={cycles.data} onSelectCycle={() => undefined} />
        <ContributionExplorer cycleId={cycle.id} cycleName={cycle.name} />
      </div>
    </PageContainer>
  );
}
