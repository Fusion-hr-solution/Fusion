"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DetailsStepSkeleton } from "@/features/performance/components/cycle-setup/setup-skeletons";
import { useSelectedCycleId, useWorkspaceContext } from "@/features/performance/api/use-workspace";
import { setupStepHref } from "@/features/performance/components/cycle-setup/setup-readiness";

/** /cycle/setup has no content of its own — it opens the first step. */
export default function CycleSetupIndex() {
  const router = useRouter();
  const routeCycleId = useSelectedCycleId();
  const context = useWorkspaceContext(routeCycleId === null);
  useEffect(() => {
    if (routeCycleId === null && context.isLoading) return;
    router.replace(setupStepHref("details", routeCycleId ?? context.data?.selected?.id));
  }, [router, routeCycleId, context.isLoading, context.data?.selected?.id]);
  return <DetailsStepSkeleton />;
}
