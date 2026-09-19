"use client";

import { useCurrentCycle } from "@/features/performance/api/use-performance";
import { CycleDetailsStep } from "@/features/performance/components/cycle-setup/cycle-details-step";

/** Step 1 is always reachable — with no draft it creates one, with a draft it edits it. */
export default function CycleSetupDetailsPage() {
  const detail = useCurrentCycle();
  return <CycleDetailsStep detail={detail.data ?? null} />;
}
