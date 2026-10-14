"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PageContainer, PagePermissionNotice } from "@repo/ds/shell";
import { CycleSurfaceSkeleton } from "@/features/performance/components/cycle-setup/setup-skeletons";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { useCurrentCycle, useCycleClosure } from "@/features/performance/api/use-performance";
import { useWorkspaceContext } from "@/features/performance/api/use-workspace";
import { ClosureSection, CloseCycleAction } from "@/features/performance/components/cycle/cycle-closure";
import { PerformancePageHeading } from "@/features/performance/components/performance-page-heading";
import { MilestoneRail } from "@/features/performance/components/milestone-rail";

/**
 * The durable Cycle surface — the established (Active/Closed) Cycle, read-only. A Draft is still
 * being created, so it belongs to the guided setup flow (/cycle/setup), and no Cycle at all means
 * there is nothing to manage. Both redirect out.
 */
const PHASE_LABEL = { Planning: "Planning", Execution: "Execution", Review: "Review" } as const;

export default function CyclePage() {
  const router = useRouter();
  const context = useWorkspaceContext();
  const canAdminister = context.data?.capabilities.administers ?? false;
  const detail = useCurrentCycle(canAdminister);

  const cycle = detail.data?.cycle;
  const cycleId = cycle?.id;
  const isDraft = cycle?.state === "Draft";
  const ready = !context.isLoading && !detail.isLoading;
  const noCycle = ready && canAdminister && !detail.data;
  const closure = useCycleClosure(cycle && !isDraft ? cycle.id : null, canAdminister);

  useEffect(() => {
    if (isDraft && cycleId) router.replace(`/cycle/setup?cycle=${encodeURIComponent(cycleId)}`);
  }, [isDraft, cycleId, router]);
  useEffect(() => {
    if (noCycle) router.replace("/");
  }, [noCycle, router]);

  if (context.isLoading) return <CycleSurfaceSkeleton />;
  if (context.error && !canAdminister) return <PagePermissionNotice title="Administration only" description="Cycle administration is available to performance administrators." />;
  if (context.error) return <ContentUnavailable error={context.error} onRetry={context.refetch} subject="Performance workspace" />;
  if (!canAdminister) {
    return (
      <PagePermissionNotice
        title="Administration only"
        description="Cycle administration is available to performance administrators."
      />
    );
  }
  if (detail.isLoading) return <CycleSurfaceSkeleton />;
  if (detail.error) {
    return <ContentUnavailable error={detail.error} onRetry={detail.refetch} subject="The Cycle" />;
  }
  if (!detail.data || isDraft) return <CycleSurfaceSkeleton />;

  const cycleDetail = detail.data;
  const isActive = cycleDetail.cycle.state === "Active";

  return (
    <PageContainer>
      <PerformancePageHeading
        title={cycleDetail.cycle.name}
        description={isActive ? PHASE_LABEL[cycleDetail.phase ?? "Planning"] : "Closed"}
        actions={isActive ? <CloseCycleAction detail={cycleDetail} closure={closure.data} /> : null}
      />
      <div className="space-y-8">
        <MilestoneRail milestones={cycleDetail.milestones} />
        {closure.error ? (
          <ContentUnavailable error={closure.error} onRetry={closure.refetch} subject="Closure readiness" />
        ) : (
          <ClosureSection closure={closure.data} loading={closure.isLoading} />
        )}
      </div>
    </PageContainer>
  );
}
