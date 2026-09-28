"use client";

import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { CycleContextBar } from "@/features/performance/components/cycle-context-bar";
import { useCurrentCycle, usePerformanceAccess } from "@/features/performance/api/use-performance";

/**
 * The top-bar binding of the Cycle context. Shares the pages' current-Cycle query, so it adds no
 * request and follows every invalidation. Access, error, and no-Cycle states belong to the page
 * body; here they simply render nothing.
 */
export function PerformanceCycleContext() {
  const access = usePerformanceAccess();
  const enabled = (access.data?.canEnter ?? false) || (access.data?.canAdminister ?? false);
  const detail = useCurrentCycle(enabled);
  const cycle = detail.data?.cycle ?? null;

  if (access.isLoading || (enabled && detail.isLoading)) {
    return <Skeleton className="h-5 w-72 max-w-full" aria-hidden />;
  }
  if (!cycle) return null;
  return <CycleContextBar cycle={cycle} />;
}
