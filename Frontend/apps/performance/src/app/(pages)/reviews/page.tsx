"use client";

import { useState } from "react";
import { PageContainer, PageError, PagePermissionNotice, PageSkeleton } from "@repo/ds/shell";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { CycleWorkspaceHeader } from "@/features/performance/components/cycle-workspace-header";
import { ManagerDecisionWorkspace } from "@/features/performance/components/plan/manager-decision-workspace";
import { PlanReviewQueue } from "@/features/performance/components/plan/plan-review-queue";
import { usePerformanceAccess, useCurrentCycle, useCycles, usePlanReviews } from "@/features/performance/api/use-performance";

export default function ReviewsPage() {
  const access = usePerformanceAccess();
  const canEnter = access.data?.canEnter ?? false;
  const scope = access.data?.aggregateViewScope ?? null;
  const canReview =
    (access.data?.canAdminister ?? false) || scope === "DirectReports" || scope === "OrgUnit" || scope === "Tenant";

  const detail = useCurrentCycle(canEnter);
  const cycles = useCycles(canEnter);
  const cycle = detail.data?.cycle ?? null;
  const reviews = usePlanReviews(cycle?.id ?? null, canReview);

  const [openPlanId, setOpenPlanId] = useState<string | null>(null);

  if (access.isLoading) return <PageSkeleton rows={4} label="Loading Performance" />;
  if (!canReview) {
    return (
      <PagePermissionNotice
        title="No plans to review"
        description="Plan review is available to managers responsible for a team in an active cycle."
      />
    );
  }
  if (detail.isLoading) return <PageSkeleton rows={4} label="Loading Cycle" />;
  if (detail.error) return <ContentUnavailable error={detail.error} onRetry={detail.refetch} subject="The Cycle" />;
  if (!cycle) {
    return (
      <PageContainer>
        <PagePermissionNotice title="No cycle yet" description="Plan reviews open once a cycle is active." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-8">
        <CycleWorkspaceHeader cycle={cycle} cycles={cycles.data} onSelectCycle={() => undefined} />

        {openPlanId ? (
          <ManagerDecisionWorkspace cycleId={cycle.id} planId={openPlanId} onBack={() => setOpenPlanId(null)} />
        ) : reviews.isLoading ? (
          <PageSkeleton rows={3} label="Loading reviews" />
        ) : reviews.error || !reviews.data ? (
          <PageError title="Reviews unavailable" description={reviews.error?.message} onRetry={reviews.refetch} />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">Plans to review</h2>
              {reviews.data.awaitingDecisionCount > 0 ? (
                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning tabular-nums">
                  {reviews.data.awaitingDecisionCount}
                </span>
              ) : null}
            </div>
            <PlanReviewQueue plans={reviews.data.plans} onOpen={setOpenPlanId} />
          </div>
        )}
      </div>
    </PageContainer>
  );
}
