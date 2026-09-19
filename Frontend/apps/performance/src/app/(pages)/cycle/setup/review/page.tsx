"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageSkeleton } from "@repo/ds/shell";
import { useCurrentCycle } from "@/features/performance/api/use-performance";
import { ReviewLaunchStep } from "@/features/performance/components/cycle-setup/review-launch-step";
import {
  canAccessStep,
  deriveSetupState,
  earliestIncompleteStep,
  setupStepHref,
} from "@/features/performance/components/cycle-setup/setup-readiness";

/** Step 3 needs a confirmed population; otherwise resolve to the earliest step still open. */
export default function CycleSetupReviewPage() {
  const router = useRouter();
  const detail = useCurrentCycle();
  const setup = deriveSetupState(detail.data);
  const allowed = canAccessStep("review", setup);

  useEffect(() => {
    if (!detail.isLoading && !allowed) router.replace(setupStepHref(earliestIncompleteStep(setup)));
  }, [detail.isLoading, allowed, setup, router]);

  if (!detail.data || !allowed) return <PageSkeleton rows={4} label="Loading review" />;
  return <ReviewLaunchStep detail={detail.data} />;
}
