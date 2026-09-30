"use client";

import { useParams } from "next/navigation";
import { PageContainer, PagePermissionNotice } from "@repo/ds/shell";
import { PlanPageSkeleton } from "@/features/performance/components/plan/plan-skeleton";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { PlanReview } from "@/features/performance/components/plan/plan-review";
import { usePerformanceAccess, useCurrentCycle } from "@/features/performance/api/use-performance";

/**
 * The canonical submitted-Plan resource, opened by its assigned reviewer (a notification links here
 * directly, not through the Team queue). The same Plan an employee authors — the server authorizes the
 * reviewer and gates the decision; the page only needs the caller to be a Performance entrant, and the
 * plan-detail query enforces the rest.
 */
export default function PlanReviewPage() {
  const params = useParams<{ planId: string }>();
  const planId = params.planId;

  const access = usePerformanceAccess();
  const canEnter = access.data?.canEnter ?? false;

  const detail = useCurrentCycle(canEnter);
  const cycle = detail.data?.cycle ?? null;

  if (access.isLoading) return <PlanPageSkeleton />;
  if (!canEnter) {
    return (
      <PagePermissionNotice
        title="Plan not available"
        description="Reviewing a plan is available to managers responsible for a team in an active cycle."
      />
    );
  }
  if (detail.isLoading) return <PlanPageSkeleton />;
  if (detail.error) return <ContentUnavailable error={detail.error} onRetry={detail.refetch} subject="The Cycle" />;
  if (!cycle) {
    return (
      <PageContainer>
        <PagePermissionNotice title="No cycle yet" description="Plans open once a Performance cycle is active." />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-7xl">
      <PlanReview cycle={cycle} planId={planId} />
    </PageContainer>
  );
}
