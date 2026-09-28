"use client";

import { PageContainer, PagePermissionNotice } from "@repo/ds/shell";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { PerformancePageHeading } from "@/features/performance/components/performance-page-heading";
import { TeamDirection, TeamDirectionSkeleton } from "@/features/performance/components/team/team-direction";
import { AddPeopleCallout, RosterSkeleton, YourPeople } from "@/features/performance/components/team/your-people";
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

  if (access.isLoading) return <TeamPageSkeleton />;
  if (!canReview) {
    return (
      <PagePermissionNotice
        title="No team to review"
        description="Team Performance is available to managers responsible for a team in an active cycle."
      />
    );
  }
  if (detail.isLoading) return <TeamPageSkeleton />;
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
      <PerformancePageHeading
        title="Team Performance"
        size="display"
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

/** Shape-matched page loading: cycle context, display title, Team Direction, Your People. */
function TeamPageSkeleton() {
  return (
    <PageContainer width="wide">
      <div role="status" aria-label="Loading Team Performance">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="hidden h-4 w-40 md:block" />
        </div>
        <div className="mb-4 mt-5 space-y-2.5">
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-4 w-56" />
        </div>
        <TeamDirectionSkeleton />
        <RosterSkeleton />
      </div>
    </PageContainer>
  );
}
