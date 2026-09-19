"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PageContainer, PagePermissionNotice, PageSkeleton } from "@repo/ds/shell";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { useCurrentCycle, usePerformanceAccess } from "@/features/performance/api/use-performance";
import { CycleContextBar } from "@/features/performance/components/cycle-context-bar";
import { PerformancePageHeading } from "@/features/performance/components/performance-page-heading";
import { MilestoneRail } from "@/features/performance/components/milestone-rail";

/**
 * The durable Cycle surface — the established (Active/Closed) Cycle, read-only. A Draft is still
 * being created, so it belongs to the guided setup flow (/cycle/setup), and no Cycle at all means
 * there is nothing to manage. Both redirect out.
 */
export default function CyclePage() {
  const router = useRouter();
  const access = usePerformanceAccess();
  const canAdminister = access.data?.canAdminister ?? false;
  const detail = useCurrentCycle(canAdminister);

  const cycle = detail.data?.cycle;
  const isDraft = cycle?.state === "Draft";
  const ready = !access.isLoading && !detail.isLoading;
  const noCycle = ready && canAdminister && !detail.data;

  useEffect(() => {
    if (isDraft) router.replace("/cycle/setup");
  }, [isDraft, router]);
  useEffect(() => {
    if (noCycle) router.replace("/");
  }, [noCycle, router]);

  if (access.isLoading) return <PageSkeleton rows={4} label="Loading Performance" />;
  if (!canAdminister) {
    return (
      <PagePermissionNotice
        title="Administration only"
        description="Cycle administration is available to performance administrators."
      />
    );
  }
  if (detail.isLoading) return <PageSkeleton rows={4} label="Loading Cycle" />;
  if (detail.error) {
    return <ContentUnavailable error={detail.error} onRetry={detail.refetch} subject="The Cycle" />;
  }
  if (!detail.data || isDraft) return <PageSkeleton rows={4} label="Loading Cycle" />;

  const cycleDetail = detail.data;
  const isActive = cycleDetail.cycle.state === "Active";

  return (
    <PageContainer>
      <CycleContextBar cycle={cycleDetail.cycle} />
      <PerformancePageHeading
        title="Cycle"
        description={
          isActive
            ? "Planning is open. This Cycle's setup is now read-only history."
            : "This Cycle is closed."
        }
      />
      <div className="space-y-8">
        <MilestoneRail milestones={cycleDetail.milestones} />
        {/* Population read-only surface temporarily stubbed while the population UI is rebuilt. */}
        <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center">
          <p className="type-body-secondary text-muted-foreground">
            Population summary — building next.
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
