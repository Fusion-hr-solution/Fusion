"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarPlus, LineChart, Rocket, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@repo/ds/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@repo/ds/components/ui/empty";
import { KpiGrid, KpiStat, PageContainer, PagePermissionNotice, PageSkeleton } from "@repo/ds/shell";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import type { CycleDetailDto } from "@repo/api";
import {
  useActivateCycle,
  useCreateCycle,
  useCurrentCycle,
  useCycles,
  usePerformanceAccess,
} from "@/features/performance/api/use-performance";
import { CycleWorkspaceHeader } from "@/features/performance/components/cycle-workspace-header";
import { LaunchReadiness } from "@/features/performance/components/launch-readiness";
import { MilestoneRail } from "@/features/performance/components/milestone-rail";
import { ActivationReview } from "@/features/performance/components/activation-review";
import { CycleDetailsDialog } from "@/features/performance/components/cycle-details-dialog";

export default function OverviewPage() {
  const router = useRouter();
  const access = usePerformanceAccess();
  const canEnter = access.data?.canEnter ?? false;
  // Access is derived from the session (no round-trip), so the primary Cycle
  // detail and the Cycle list load together in one parallel wave — no
  // access→cycles→detail chain.
  const detail = useCurrentCycle(canEnter);
  const cycles = useCycles(canEnter);
  const createCycle = useCreateCycle();
  const [createOpen, setCreateOpen] = useState(false);

  if (access.isLoading) return <PageSkeleton rows={4} label="Loading Performance" />;
  if (!canEnter) {
    return (
      <PagePermissionNotice
        title="No Performance access"
        description="You do not have access to the Performance workspace."
      />
    );
  }

  const canAdminister = access.data?.canAdminister ?? false;

  if (detail.isLoading) return <PageSkeleton rows={4} label="Loading Cycle" />;
  if (detail.error) {
    return <ContentUnavailable error={detail.error} onRetry={detail.refetch} subject="The Cycle" />;
  }

  // No Cycle yet.
  if (!detail.data) {
    return (
      <PageContainer>
        <Empty className="min-h-[60vh]">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Sparkles /></EmptyMedia>
            <EmptyTitle>Performance starts with a Cycle</EmptyTitle>
            <EmptyDescription>
              A Cycle frames one planning-and-progress horizon — its dates, direction, and people. Create one to begin.
            </EmptyDescription>
          </EmptyHeader>
          {canAdminister ? (
            <EmptyContent>
              <Button size="lg" onClick={() => setCreateOpen(true)}>
                <CalendarPlus className="size-4" data-icon="inline-start" /> Create the first Cycle
              </Button>
            </EmptyContent>
          ) : (
            <EmptyContent>
              <p className="text-sm text-muted-foreground">No active Cycle yet. Your administrator sets this up.</p>
            </EmptyContent>
          )}
        </Empty>
        <CycleDetailsDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSubmit={async (value) => {
            const created = await createCycle.mutateAsync({
              name: value.name,
              startDate: value.startDate,
              endDate: value.endDate,
              planningDeadline: value.planningDeadline,
            });
            toast.success(`${created.name} created.`);
            router.push("/setup");
          }}
        />
      </PageContainer>
    );
  }

  const cycleDetail = detail.data;

  return (
    <PageContainer>
      <div className="space-y-8">
        <CycleWorkspaceHeader
          cycle={cycleDetail.cycle}
          cycles={cycles.data}
          onSelectCycle={() => undefined}
          actions={
            cycleDetail.cycle.state === "Draft" && canAdminister ? (
              <Button variant="outline" onClick={() => router.push("/setup")}>Continue setup</Button>
            ) : undefined
          }
        />

        <MilestoneRail milestones={cycleDetail.milestones} />

        {cycleDetail.cycle.state === "Draft" ? (
          <DraftOverview cycleId={cycleDetail.cycle.id} detail={cycleDetail} canAdminister={canAdminister} />
        ) : (
          <ActiveOverview detail={cycleDetail} />
        )}
      </div>
    </PageContainer>
  );
}

function DraftOverview({
  cycleId,
  detail,
  canAdminister,
}: {
  cycleId: string;
  detail: CycleDetailDto;
  canAdminister: boolean;
}) {
  const router = useRouter();
  const activate = useActivateCycle(cycleId);
  const [reviewOpen, setReviewOpen] = useState(false);

  return (
    <>
      <LaunchReadiness
        readiness={detail.launchReadiness}
        onOpenArea={canAdminister ? (area) => router.push(`/setup?area=${area}`) : undefined}
        onActivate={canAdminister ? () => setReviewOpen(true) : undefined}
      />
      <ActivationReview
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        detail={detail}
        onActivate={async () => {
          await activate.mutateAsync();
        }}
      />
    </>
  );
}

function ActiveOverview({ detail }: { detail: CycleDetailDto }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success-subtle px-4 py-3">
        <Rocket className="size-4 text-success" aria-hidden />
        <p className="text-sm">
          <span className="font-medium">Planning is open.</span>{" "}
          <span className="text-muted-foreground">The roster and direction are locked into this Cycle.</span>
        </p>
      </div>
      <KpiGrid>
        <KpiStat label="Participants" value={detail.confirmedParticipantCount} icon={LineChart} />
        <KpiStat label="Published direction" value={detail.publishedStrategyCount} />
        <KpiStat label="Draft strategy" value={detail.draftStrategyCount} />
      </KpiGrid>
    </div>
  );
}
