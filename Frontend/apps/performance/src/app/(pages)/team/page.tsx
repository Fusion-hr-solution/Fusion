"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageContainer, PagePermissionNotice } from "@repo/ds/shell";
import { Button } from "@repo/ds/components/ui/button";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { PerformancePageHeading } from "@/features/performance/components/performance-page-heading";
import { TeamDirection, TeamDirectionSkeleton } from "@/features/performance/components/team/team-direction";
import type { YourPeopleQuery } from "@repo/api";
import {
  AddPeopleCallout,
  DEFAULT_PEOPLE_QUERY,
  RosterSkeleton,
  YourPeople,
} from "@/features/performance/components/team/your-people";
import { useCurrentCycle, useYourPeople } from "@/features/performance/api/use-performance";
import { useWorkspaceContext } from "@/features/performance/api/use-workspace";

export default function TeamPerformancePage() {
  // Team Performance belongs to people Performance records as responsible reviewers in this Cycle.
  const context = useWorkspaceContext();
  const canReview = context.data?.destinations.team ?? false;
  // The organization-direction link is offered only to actors who can enter that workspace.
  const canViewOrgDirection = context.data?.capabilities.canViewOrgDirection ?? false;

  const detail = useCurrentCycle(Boolean(context.data));
  const cycle = detail.data?.cycle ?? null;
  // Overview's "Review plans" lands here already on the view that needs the manager.
  const opensOnReview = useSearchParams().get("view") === "needs-review";
  const [peopleQuery, setPeopleQuery] = useState<YourPeopleQuery>(() =>
    opensOnReview ? { ...DEFAULT_PEOPLE_QUERY, filter: "NeedsReview" } : DEFAULT_PEOPLE_QUERY
  );
  const people = useYourPeople(cycle?.id ?? null, peopleQuery, canReview);

  if (context.isLoading) return <TeamPageSkeleton />;
  if (context.error) return <ContentUnavailable error={context.error} onRetry={context.refetch} subject="Performance workspace" />;
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

  const count = people.data?.counts.needsReview ?? 0;

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
                setPeopleQuery({ ...DEFAULT_PEOPLE_QUERY, filter: "NeedsReview" });
                document.getElementById("your-people")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Review {count} plan{count === 1 ? "" : "s"}
            </Button>
          ) : null
        }
      />
      <div className="mt-8 space-y-9">
        <TeamDirection cycle={cycle} canViewOrgDirection={canViewOrgDirection} />
        <div className="space-y-4">
          <YourPeople cycleId={cycle.id} people={people} query={peopleQuery} onQueryChange={setPeopleQuery} />
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
