"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, Trash2 } from "@/lib/icons";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ds/components/ui/alert-dialog";
import { Button } from "@repo/ds/components/ui/button";
import { AsyncButton, PageContainer, PagePermissionNotice } from "@repo/ds/shell";
import { performanceFailure, reportPerformanceFailure } from "@/features/performance/api/performance-failure";
import { SetupShellSkeleton } from "@/features/performance/components/cycle-setup/setup-skeletons";
import { useCurrentCycle, useDeleteDraftCycle } from "@/features/performance/api/use-performance";
import { useWorkspaceContext } from "@/features/performance/api/use-workspace";
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
  const context = useWorkspaceContext();
  const canAdminister = context.data?.capabilities.administers ?? false;
  const detail = useCurrentCycle(canAdminister);

  const cycle = detail.data?.cycle;
  const establishedCycle = cycle ? cycle.state !== "Draft" : false;

  useEffect(() => {
    if (establishedCycle) router.replace("/cycle");
  }, [establishedCycle, router]);

  const fallbackExit = useCallback(() => router.push("/"), [router]);

  if (context.isLoading) return <SetupShellSkeleton step={currentStep(pathname)} label="Loading Performance" />;
  if (context.error && !canAdminister) return <PagePermissionNotice title="Administration only" description="Cycle setup is available to performance administrators." />;
  if (context.error) return <ContentUnavailable error={context.error} onRetry={context.refetch} subject="Performance workspace" />;
  if (!canAdminister) {
    return (
      <PagePermissionNotice
        title="Administration only"
        description="Cycle setup is available to performance administrators."
      />
    );
  }
  if (detail.isLoading) return <SetupShellSkeleton step={currentStep(pathname)} />;
  if (detail.error) {
    return <ContentUnavailable error={detail.error} onRetry={detail.refetch} subject="The Cycle" />;
  }
  if (establishedCycle) return <SetupShellSkeleton step={currentStep(pathname)} label="Opening Cycle" />;

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
        <SetupHeader cycleId={cycle?.id ?? null} cycleName={cycle?.name ?? null} cycleVersion={cycle?.version ?? null} />
        <div className="mt-7">
          <CycleSetupStepper current={active} state={stepState} cycleId={cycle?.id ?? null} />
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

function SetupHeader({ cycleId, cycleName, cycleVersion }: { cycleId: string | null; cycleName: string | null; cycleVersion: number | null }) {
  const shell = useSetupShell();
  return (
    <div className="flex items-center justify-between gap-4">
      <h1 className="type-page-title text-foreground">Create Performance Cycle</h1>
      <div className="flex items-center gap-2">
        {cycleId && cycleVersion !== null ? <DiscardDraft cycleId={cycleId} cycleName={cycleName} version={cycleVersion} /> : null}
        <Button variant="outline" onClick={() => shell.runExit()}>
          <Save className="size-4" data-icon="inline-start" />
          Save and exit
        </Button>
      </div>
    </div>
  );
}

/** Deletes the unused Draft Cycle and its setup, then returns to Overview. */
function DiscardDraft({ cycleId, cycleName, version }: { cycleId: string; cycleName: string | null; version: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const discard = useDeleteDraftCycle(cycleId);
  const pending = discard.isLoading;

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="text-muted-foreground">
          <Trash2 className="size-4" data-icon="inline-start" />
          Discard draft
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard {cycleName ?? "this draft"}?</AlertDialogTitle>
          <AlertDialogDescription>
            Its details, population and draft direction are deleted. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep draft</AlertDialogCancel>
          <AsyncButton
            variant="destructive"
            pending={pending}
            onClick={async () => {
              try {
                await discard.mutateAsync(version);
                toast.success(`${cycleName ?? "Draft"} discarded.`);
                setOpen(false);
                router.push("/");
              } catch (error) {
                if (performanceFailure(error).refresh) setOpen(false);
                reportPerformanceFailure(error, "Could not discard the draft.");
              }
            }}
          >
            <Trash2 className="size-4" data-icon="inline-start" /> Discard draft
          </AsyncButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
