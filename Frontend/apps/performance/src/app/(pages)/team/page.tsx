"use client";

import { PageContainer, PagePermissionNotice, PageSkeleton } from "@repo/ds/shell";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { CycleContextBar } from "@/features/performance/components/cycle-context-bar";
import { PerformancePageHeading } from "@/features/performance/components/performance-page-heading";
import { TeamDirection } from "@/features/performance/components/team/team-direction";
import { AddPeopleCallout, YourPeople } from "@/features/performance/components/team/your-people";
import { usePerformanceAccess, useCurrentCycle, useTeamRoster } from "@/features/performance/api/use-performance";

export default function TeamPerformancePage() {
  const access = usePerformanceAccess();
  const canEnter = access.data?.canEnter ?? false;
  const scope = access.data?.aggregateViewScope ?? null;
  const canReview =
    (access.data?.canAdminister ?? false) || scope === "DirectReports" || scope === "OrgUnit" || scope === "Tenant";
  // Organization Goals gate, mirrored from that surface, so the section-level link is offered only to
  // actors who can legitimately open it.
  const canViewOrgGoals =
    canReview || (access.data?.canPublishStrategy ?? false) || (access.data?.canManageOrgObjectives ?? false);

  const detail = useCurrentCycle(canEnter);
  const cycle = detail.data?.cycle ?? null;
  const roster = useTeamRoster(cycle?.id ?? null, canReview);

  if (access.isLoading) return <PageSkeleton rows={4} label="Loading Performance" />;
  if (!canReview) {
    return (
      <PagePermissionNotice
        title="No team to review"
        description="Team Performance is available to managers responsible for a team in an active cycle."
      />
    );
  }
  if (detail.isLoading) return <PageSkeleton rows={4} label="Loading Cycle" />;
  if (detail.error) return <ContentUnavailable error={detail.error} onRetry={detail.refetch} subject="The Cycle" />;
  if (!cycle) {
    return (
      <PageContainer>
        <PagePermissionNotice title="No cycle yet" description="Team Performance opens once a cycle is active." />
      </PageContainer>
    );
  }

  const count = roster.data?.needsReviewCount ?? 0;

  return (
    <PageContainer width="wide">
      <CycleContextBar cycle={cycle} />
      <PerformancePageHeading
        title="Team Performance"
        description={
          roster.isLoading || !roster.data
            ? undefined
            : count === 0
              ? "No plans are waiting on you right now."
              : `${count} plan${count === 1 ? "" : "s"} need${count === 1 ? "s" : ""} your decision.`
        }
      />
      <TeamDirection cycle={cycle} canViewOrgGoals={canViewOrgGoals} />
      <YourPeople roster={roster} />
      <AddPeopleCallout />
    </PageContainer>
  );
}
