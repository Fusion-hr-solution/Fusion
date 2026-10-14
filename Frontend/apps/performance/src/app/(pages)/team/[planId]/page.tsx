"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageContainer, PagePermissionNotice } from "@repo/ds/shell";
import { planHref } from "@/lib/performance-routes";
import { PlanPageSkeleton } from "@/features/performance/components/plan/plan-skeleton";
import { useCurrentCycle } from "@/features/performance/api/use-performance";
import { useWorkspaceContext } from "@/features/performance/api/use-workspace";

/**
 * Older reviewer links addressed a plan without its Cycle and always meant the current one. They now
 * replace themselves with the plan's canonical, Cycle-addressed record.
 */
export default function LegacyPlanReviewRedirect() {
  const { planId } = useParams<{ planId: string }>();
  const router = useRouter();
  const context = useWorkspaceContext();
  const current = useCurrentCycle(Boolean(context.data));
  const cycleId = current.data?.cycle.id;

  useEffect(() => {
    if (cycleId) router.replace(planHref({ cycleId, planId }));
  }, [cycleId, planId, router]);

  if (!context.isLoading && !current.isLoading && !cycleId) {
    return (
      <PageContainer>
        <PagePermissionNotice title="Plan unavailable" />
      </PageContainer>
    );
  }
  return <PlanPageSkeleton />;
}
