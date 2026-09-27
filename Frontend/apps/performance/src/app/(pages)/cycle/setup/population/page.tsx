"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PopulationStepSkeleton } from "@/features/performance/components/cycle-setup/setup-skeletons";
import { useCurrentCycle } from "@/features/performance/api/use-performance";
import { PopulationStep } from "@/features/performance/components/cycle-setup/population-step";
import { canAccessStep, deriveSetupState } from "@/features/performance/components/cycle-setup/setup-readiness";

/** Step 2 needs a draft to exist; without one, resolve back to Step 1. */
export default function CycleSetupPopulationPage() {
  const router = useRouter();
  const detail = useCurrentCycle();
  const setup = deriveSetupState(detail.data);
  const allowed = canAccessStep("population", setup);

  useEffect(() => {
    if (!detail.isLoading && !allowed) router.replace("/cycle/setup/details");
  }, [detail.isLoading, allowed, router]);

  if (!detail.data || !allowed) return <PopulationStepSkeleton />;
  return <PopulationStep cycleId={detail.data.cycle.id} />;
}
