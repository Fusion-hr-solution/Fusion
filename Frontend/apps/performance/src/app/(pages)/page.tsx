"use client";

import { Fragment, useMemo } from "react";
import { PageContainer, PagePermissionNotice, PageSkeleton } from "@repo/ds/shell";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { PerformancePageHeading } from "@/features/performance/components/performance-page-heading";
import { useCycles, usePerformanceAccess } from "@/features/performance/api/use-performance";
import { formatDate } from "@/features/performance/lib";
import {
  cyclePhase,
  localToday,
  resolveOverview,
  selectOverviewCycles,
  type OverviewSectionId,
} from "@/features/performance/components/overview/overview-model";
import {
  MyPlanSection,
  TeamAttentionSection,
  TeamObjectiveSection,
} from "@/features/performance/components/overview/personal-sections";
import {
  ClosedCycleSection,
  CycleStatusSection,
  NoCycleSection,
  OrgDirectionSection,
  PlanningOperationSection,
  SetupSection,
} from "@/features/performance/components/overview/organization-sections";

/**
 * Overview: what state Performance is in, what needs this person, and where to go next. The sections
 * are composed from the person's capabilities and the tenant's cycles — never from a persona — and
 * each one ends in a workspace or an objective record.
 */
export default function OverviewPage() {
  const access = usePerformanceAccess();
  const a = access.data;
  const canEnter = a?.canEnter ?? false;
  const cycles = useCycles(canEnter);
  const overviewCycles = useMemo(() => selectOverviewCycles(cycles.data ?? []), [cycles.data]);

  if (access.isLoading || !a) return <PageSkeleton rows={4} label="Loading Performance" />;
  if (!canEnter) {
    return (
      <PagePermissionNotice
        title="No Performance access"
        description="You do not have access to the Performance workspace."
      />
    );
  }
  if (cycles.isLoading) return <PageSkeleton rows={4} label="Loading Overview" />;
  if (cycles.error) {
    return <ContentUnavailable error={cycles.error} onRetry={cycles.refetch} subject="Overview" />;
  }

  const sections = resolveOverview({
    cycles: overviewCycles,
    canParticipate: a.canParticipate,
    canLeadTeam: a.canLeadTeam,
    canManageTeamObjectives: a.canManageOrgObjectives || a.canAdminister,
    canViewOrgDirection: a.canViewOrgDirection,
    canAdminister: a.canAdminister,
  });
  const { active, draft, latestClosed } = overviewCycles;
  const phase = active ? cyclePhase(active, localToday()) : null;

  const render = (id: OverviewSectionId) => {
    switch (id) {
      case "my-plan":
        return active ? <MyPlanSection cycle={active} /> : null;
      case "team-attention":
        return active ? <TeamAttentionSection cycle={active} /> : null;
      case "team-objective":
        return active ? <TeamObjectiveSection cycle={active} /> : null;
      case "planning-operation":
        return active ? <PlanningOperationSection cycle={active} /> : null;
      case "org-direction":
        return active ? <OrgDirectionSection cycle={active} /> : null;
      case "setup":
        return draft ? <SetupSection cycle={draft} /> : null;
      case "closed-cycle":
        return latestClosed ? (
          <ClosedCycleSection
            cycle={latestClosed}
            canAdminister={a.canAdminister}
            canParticipate={a.canParticipate}
            canCreateNext={a.canAdminister && !draft}
          />
        ) : null;
      case "no-cycle":
        return <NoCycleSection canAdminister={a.canAdminister} />;
      case "cycle-status":
        return active ? <CycleStatusSection cycle={active} /> : <NoCycleSection canAdminister={false} />;
    }
  };

  return (
    <PageContainer>
      <PerformancePageHeading
        title="Overview"
        size="display"
        // The cycle bar above names the cycle and its planning deadline; once planning has closed it
        // goes quiet, so the phase is stated here instead of repeated.
        description={active && phase && !phase.planningOpen ? `Execution until ${formatDate(active.endDate)}` : undefined}
      />
      <div className="mt-8 max-w-4xl space-y-8">
        {sections.map((id) => (
          <Fragment key={id}>{render(id)}</Fragment>
        ))}
      </div>
    </PageContainer>
  );
}
