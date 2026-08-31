"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Check, Pencil, Target, Users } from "lucide-react";
import { toast } from "sonner";
import type { CycleDetailDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { PageContainer, PageError, PagePermissionNotice, PageSkeleton } from "@repo/ds/shell";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { cn } from "@repo/ds/lib/utils";
import {
  useActivateCycle,
  useCurrentCycle,
  useCycles,
  usePerformanceAccess,
  useStrategy,
  useUpdateCycle,
} from "@/features/performance/api/use-performance";
import { setupMilestones } from "@/features/performance/lib";
import { CycleContextBar } from "@/features/performance/components/cycle-context-bar";
import { PerformancePageHeading } from "@/features/performance/components/performance-page-heading";
import { LaunchReadiness } from "@/features/performance/components/launch-readiness";
import { MilestoneRail } from "@/features/performance/components/milestone-rail";
import { ActivationReview } from "@/features/performance/components/activation-review";
import { CycleDetailsDialog } from "@/features/performance/components/cycle-details-dialog";
import { StrategicDirection } from "@/features/performance/components/strategic-direction";
import { PopulationLens } from "@/features/performance/components/population-lens";

type Area = "direction" | "population" | "review";

const AREAS: { key: Area; label: string; icon: typeof Target }[] = [
  { key: "direction", label: "Strategic direction", icon: Target },
  { key: "population", label: "Population", icon: Users },
  { key: "review", label: "Review & activate", icon: Check },
];

export default function SetupPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={4} label="Loading Cycle" />}>
      <SetupWorkspace />
    </Suspense>
  );
}

function SetupWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const access = usePerformanceAccess();
  const canAdminister = access.data?.canAdminister ?? false;
  // Access is session-derived; the primary Cycle detail loads directly.
  const detail = useCurrentCycle(canAdminister);

  const [area, setArea] = useState<Area>("direction");
  const [editOpen, setEditOpen] = useState(false);
  const update = useUpdateCycle(detail.data?.cycle.id ?? "");
  useEffect(() => {
    const requested = searchParams.get("area") as Area | null;
    if (requested && AREAS.some((item) => item.key === requested)) setArea(requested);
  }, [searchParams]);

  // When there is no Cycle to set up, send the admin back to Overview — as an effect, never
  // during render, so the server and client trees match.
  const ready = !access.isLoading && !detail.isLoading;
  const noCycle = ready && canAdminister && !detail.data;
  useEffect(() => {
    if (noCycle) router.replace("/");
  }, [noCycle, router]);

  if (access.isLoading) return <PageSkeleton rows={4} label="Loading Performance" />;
  if (!canAdminister) {
    return <PagePermissionNotice title="Administration only" description="Cycle setup is available to performance administrators." />;
  }
  if (detail.isLoading) return <PageSkeleton rows={4} label="Loading Cycle" />;
  if (detail.error) {
    return <ContentUnavailable error={detail.error} onRetry={detail.refetch} subject="The Cycle" />;
  }
  if (!detail.data) {
    return <PageSkeleton rows={4} label="Loading Cycle" />;
  }

  const cycleDetail = detail.data;
  const readOnly = cycleDetail.cycle.state !== "Draft";
  const areaComplete = (key: Area) =>
    cycleDetail.launchReadiness.areas.find((item) => item.key === key)?.complete ?? false;

  return (
    <PageContainer>
      <CycleContextBar
        cycle={cycleDetail.cycle}
        action={
          !readOnly ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditOpen(true)}
              aria-label="Edit cycle details"
              title="Edit cycle details"
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-4" />
            </Button>
          ) : null
        }
      />
      <PerformancePageHeading
        title="Cycle setup"
        description={
          readOnly
            ? "This Cycle is active. Setup is read-only history."
            : "Prepare direction and population before this Cycle goes live."
        }
      />
      <CycleDetailsDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        cycle={cycleDetail.cycle}
        onSubmit={async (value) => {
          await update.mutateAsync({
            name: value.name,
            startDate: value.startDate,
            endDate: value.endDate,
            planningDeadline: value.planningDeadline,
          });
          toast.success("Cycle details saved.");
        }}
      />
      <div className="space-y-8">
        <MilestoneRail milestones={setupMilestones(cycleDetail.milestones)} />

        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <nav
            className="flex gap-1 overflow-x-auto lg:sticky lg:top-6 lg:flex-col lg:self-start lg:overflow-visible"
            aria-label="Setup areas"
          >
            {AREAS.map((item) => {
              // Once the Cycle is activated, "Review & activate" is itself complete.
              const complete = item.key === "review" ? readOnly : areaComplete(item.key);
              const active = area === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setArea(item.key)}
                  className={cn(
                    "flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <item.icon className="size-4" aria-hidden />
                  <span className="flex-1 text-left">{item.label}</span>
                  {complete ? <Check className="size-3.5 text-primary" aria-hidden /> : null}
                </button>
              );
            })}
          </nav>

          <div className="min-w-0">
            {area === "direction" ? (
              <DirectionArea cycleId={cycleDetail.cycle.id} canPublish={access.data?.canPublishStrategy ?? false} readOnly={readOnly} />
            ) : null}
            {area === "population" ? <PopulationLens cycleId={cycleDetail.cycle.id} readOnly={readOnly} /> : null}
            {area === "review" ? <ReviewArea detail={cycleDetail} /> : null}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function DirectionArea({ cycleId, canPublish, readOnly }: { cycleId: string; canPublish: boolean; readOnly: boolean }) {
  const strategy = useStrategy(cycleId);
  const cycles = useCycles();
  const cycle = cycles.data?.find((item) => item.id === cycleId);
  if (strategy.isLoading || !cycle) return <PageSkeleton rows={3} label="Loading direction" />;
  if (strategy.error) return <PageError title="Direction unavailable" description={strategy.error.message} onRetry={strategy.refetch} />;
  return <StrategicDirection cycle={cycle} objectives={strategy.data ?? []} canPublish={canPublish} readOnly={readOnly} />;
}

function ReviewArea({ detail }: { detail: CycleDetailDto }) {
  const router = useRouter();
  const activate = useActivateCycle(detail.cycle.id);
  const [reviewOpen, setReviewOpen] = useState(false);

  if (detail.cycle.state !== "Draft") {
    return (
      <div className="space-y-3">
        <h2 className="type-section-title text-foreground">Review &amp; activate</h2>
        <p className="text-sm text-muted-foreground">
          {detail.cycle.name} is {detail.cycle.state.toLowerCase()}. Planning is open and setup is
          now read-only history for this Cycle.
        </p>
        <Button variant="outline" onClick={() => router.push("/")}>
          Go to overview
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="type-section-title text-foreground">Review &amp; activate</h2>
        <p className="text-sm text-muted-foreground">
          Everything that must be ready before {detail.cycle.name} goes live.
        </p>
      </div>
      <LaunchReadiness
        readiness={detail.launchReadiness}
        onActivate={() => setReviewOpen(true)}
      />
      <ActivationReview
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        detail={detail}
        onActivate={async () => {
          await activate.mutateAsync();
          router.push("/");
        }}
      />
    </div>
  );
}
