"use client";

import { useCallback, useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@repo/ds/components/ui/button";
import { PageContainer, PagePermissionNotice, PageSkeleton } from "@repo/ds/shell";
import { useCurrentCycle, usePerformanceAccess } from "@/features/performance/api/use-performance";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { CycleSetupStepper } from "@/features/performance/components/cycle-setup/cycle-setup-stepper";
import { CycleSetupHero } from "@/features/performance/components/cycle-setup/cycle-setup-hero";
import { SetupShellProvider, useSetupShell } from "@/features/performance/components/cycle-setup/setup-shell-context";
import {
  canAccessStep,
  deriveSetupState,
  SETUP_STEPS,
  type SetupStep,
} from "@/features/performance/components/cycle-setup/setup-readiness";

function currentStep(pathname: string): SetupStep {
  const match = SETUP_STEPS.find((step) => pathname.endsWith(`/${step.key}`));
  return match?.key ?? "details";
}

/**
 * The dedicated cycle-setup shell — one guided journey with its own header, stepper, and (on the
 * opening step) hero. It owns orientation while the Cycle is being created, so it does not stack
 * the operational CycleContextBar / MilestoneRail. Setup is Draft-only: an established Cycle is
 * sent to its durable /cycle surface.
 */
export default function CycleSetupLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const access = usePerformanceAccess();
  const canAdminister = access.data?.canAdminister ?? false;
  const detail = useCurrentCycle(canAdminister);

  const cycle = detail.data?.cycle;
  const establishedCycle = cycle ? cycle.state !== "Draft" : false;

  useEffect(() => {
    if (establishedCycle) router.replace("/cycle");
  }, [establishedCycle, router]);

  const fallbackExit = useCallback(() => router.push("/performance"), [router]);

  if (access.isLoading) return <PageSkeleton rows={4} label="Loading Performance" />;
  if (!canAdminister) {
    return (
      <PagePermissionNotice
        title="Administration only"
        description="Cycle setup is available to performance administrators."
      />
    );
  }
  if (detail.isLoading) return <PageSkeleton rows={4} label="Loading Cycle setup" />;
  if (detail.error) {
    return <ContentUnavailable error={detail.error} onRetry={detail.refetch} subject="The Cycle" />;
  }
  if (establishedCycle) return <PageSkeleton rows={4} label="Opening Cycle" />;

  const setup = deriveSetupState(detail.data);
  const active = currentStep(pathname);
  const stepState = {
    details: { complete: setup.detailsComplete, accessible: canAccessStep("details", setup) },
    population: { complete: setup.populationComplete, accessible: canAccessStep("population", setup) },
    review: { complete: false, accessible: canAccessStep("review", setup) },
  } as const;

  return (
    <SetupShellProvider fallbackExit={fallbackExit}>
      <PageContainer>
        <SetupHeader />
        <div className="mt-7">
          <CycleSetupStepper current={active} state={stepState} />
        </div>
        {active === "details" ? (
          <div className="mt-7">
            <CycleSetupHero />
          </div>
        ) : null}
        <div className="mt-7">{children}</div>
      </PageContainer>
    </SetupShellProvider>
  );
}

function SetupHeader() {
  const shell = useSetupShell();
  return (
    <div className="flex items-center justify-between gap-4">
      <h1 className="type-page-title text-foreground">Create Performance Cycle</h1>
      <Button variant="outline" onClick={() => shell.runExit()}>
        <Save className="size-4" data-icon="inline-start" />
        Save and exit
      </Button>
    </div>
  );
}
