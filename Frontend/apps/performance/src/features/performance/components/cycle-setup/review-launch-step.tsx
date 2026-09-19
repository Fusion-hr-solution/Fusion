"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CycleDetailDto, OrganizationHierarchyNodeDto } from "@repo/api";
import { PageSkeleton } from "@repo/ds/shell";
import { useOrgHierarchy } from "@repo/workforce-ui";
import { useActivateCycle, usePopulation, useSettings } from "@/features/performance/api/use-performance";
import { ActivationReview } from "@/features/performance/components/activation-review";
import { SetupStepFooter } from "./setup-step-footer";
import { LaunchHero } from "./review/launch-hero";
import { LaunchConsequences, LaunchReadinessPanel } from "./review/launch-rail";
import { CycleDetailsCard, PolicyCard, PopulationCard } from "./review/review-summary";

/**
 * Step 3 — the confirmation-and-launch surface. It brings the three settled decisions (cycle,
 * population, policy) together as read-only records, states launch readiness and consequences
 * beside them, and offers the single irreversible launch action, gated on the Cycle's own
 * authoritative readiness. On launch it lands on the established Cycle at /cycle.
 */
export function ReviewLaunchStep({ detail }: { detail: CycleDetailDto }) {
  const router = useRouter();
  const cycleId = detail.cycle.id;
  const activate = useActivateCycle(cycleId);
  const population = usePopulation(cycleId);
  const settings = useSettings();
  const [reviewOpen, setReviewOpen] = useState(false);

  const selection = population.data?.selection;
  const byScope = selection?.mode === "ByScope";
  const hierarchy = useOrgHierarchy(byScope, selection?.eligibilityDate);

  const unitNames = useMemo(() => {
    if (!byScope || !selection || !hierarchy.data) return null;
    const names = new Map<string, string>();
    const walk = (node: OrganizationHierarchyNodeDto) => {
      names.set(node.unit.id, node.unit.name);
      node.children.forEach(walk);
    };
    hierarchy.data.roots.forEach(walk);
    return selection.orgUnitSelections
      .map((s) => names.get(s.orgUnitId))
      .filter((name): name is string => Boolean(name));
  }, [byScope, selection, hierarchy.data]);

  const includeDescendants = Boolean(
    selection?.orgUnitSelections.some((s) => s.includeDescendants)
  );

  return (
    <div className="space-y-6">
      <LaunchHero
        detail={detail}
        onLaunch={() => setReviewOpen(true)}
        launching={activate.isLoading}
      />

      {population.data && settings.data ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            <CycleDetailsCard detail={detail} />
            <PopulationCard
              detail={detail}
              population={population.data}
              unitNames={unitNames}
              includeDescendants={includeDescendants}
            />
            <PolicyCard settings={settings.data} />
          </div>
          <div className="space-y-6">
            <LaunchReadinessPanel detail={detail} population={population.data} />
            <LaunchConsequences />
          </div>
        </div>
      ) : (
        <PageSkeleton rows={4} label="Loading review" />
      )}

      <ActivationReview
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        detail={detail}
        onActivate={async () => {
          await activate.mutateAsync();
          router.push("/cycle");
        }}
      />
      <SetupStepFooter backHref="/cycle/setup/population" />
    </div>
  );
}
