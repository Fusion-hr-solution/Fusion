"use client";

import { useState } from "react";
import { PageContainer, PagePermissionNotice } from "@repo/ds/shell";
import { Button } from "@repo/ds/components/ui/button";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { PerformancePageHeading } from "@/features/performance/components/performance-page-heading";
import { TeamDirection, TeamDirectionSkeleton } from "@/features/performance/components/team/team-direction";
import {
  AddPeopleCallout,
  RosterSkeleton,
  YourPeople,
  type RosterFilter,
} from "@/features/performance/components/team/your-people";
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
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>("all");

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
        actions={
          // Deciding on plans is the manager's most frequent job here, so it is the page's primary action.
          count > 0 ? (
            <Button
              onClick={() => {
                setRosterFilter("needsReview");
                document.getElementById("your-people")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Review {count} plan{count === 1 ? "" : "s"}
            </Button>
          ) : null
        }
      />
      <div className="mt-8 space-y-9">
        <TeamDirection cycle={cycle} canViewOrgGoals={canViewOrgGoals} />
        <div className="space-y-4">
          <YourPeople roster={roster} filter={rosterFilter} onFilterChange={setRosterFilter} />
          <AddPeopleCallout />
        </div>
      </div>
    </PageContainer>
  );
}

/**
 * Shape-matched page loading: display title, Upstream direction + Team Objectives, Your People.
 * The Cycle context lives in the module top bar, so it has no placeholder here.
 */
function TeamPageSkeleton() {
  return (
    <PageContainer width="wide">
      <div role="status" aria-label="Loading Team Performance">
        <div className="mb-4">
          <Skeleton className="h-9 w-72 max-w-full" />
        </div>
        <div className="mt-8 space-y-9">
          <TeamDirectionSkeleton />
          <RosterSkeleton />
        </div>
      </div>
    </PageContainer>
  );
}
