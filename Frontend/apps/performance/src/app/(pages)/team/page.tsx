"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageContainer } from "@repo/ds/shell";
import { Button } from "@repo/ds/components/ui/button";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { ArrowRight, Users } from "@/lib/icons";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { PerformancePageHeading } from "@/features/performance/components/performance-page-heading";
import { TeamDirection, TeamDirectionSkeleton } from "@/features/performance/components/team/team-direction";
import type { YourPeopleQuery } from "@repo/api";
import {
  DEFAULT_PEOPLE_QUERY,
  RosterSkeleton,
  YourPeople,
  leadAction,
} from "@/features/performance/components/team/your-people";
import { TeamResultsPanel, TeamSummary, teamSubtitle } from "@/features/performance/components/team/team-summary";
import { useCurrentCycle, useTeamResults, useYourPeople } from "@/features/performance/api/use-performance";
import { useWorkspaceContext } from "@/features/performance/api/use-workspace";

/**
 * My Team: the people the user is the recorded reviewer of in the selected Cycle, grouped by what needs them in
 * the phase, with the phase's facts above. Once a round's results are released, the team's results lead the page.
 * Team objectives follow while plans are made and executed.
 */
export default function MyTeamPage() {
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
  const phase = people.data?.phase;
  const results = useTeamResults(cycle?.id ?? null, canReview && (phase === "Review" || phase === "Closed"));

  if (context.isLoading || detail.isLoading) return <TeamPageSkeleton />;
  if (context.error) return <ContentUnavailable error={context.error} onRetry={context.refetch} subject="Performance workspace" />;
  if (detail.error) return <ContentUnavailable error={detail.error} onRetry={detail.refetch} subject="The Cycle" />;
  if (!canReview || !cycle) return <NoReports cycleName={cycle?.name ?? null} />;

  const lead = cycle ? leadAction(cycle.id, people.data) : null;
  const showObjectives = phase === "Planning" || phase === "Execution";

  return (
    <PageContainer width="wide">
      <PerformancePageHeading
        title="My Team"
        size="display"
        description={people.data ? teamSubtitle(people.data) : undefined}
        actions={
          lead ? (
            <Button asChild>
              <Link href={lead.href}>
                {lead.label}
                <ArrowRight className="size-4" data-icon="inline-end" aria-hidden />
              </Link>
            </Button>
          ) : null
        }
      />
      <div className="mt-8 space-y-8">
        {people.data ? <TeamSummary data={people.data} /> : null}
        {results.data ? <TeamResultsPanel results={results.data} /> : null}
        <YourPeople cycleId={cycle.id} people={people} query={peopleQuery} onQueryChange={setPeopleQuery} />
        {showObjectives ? <TeamDirection cycle={cycle} canViewOrgDirection={canViewOrgDirection} /> : null}
      </div>
    </PageContainer>
  );
}

/** An old link or bookmark without responsibility in this cycle: say so and lead back to Overview. */
function NoReports({ cycleName }: { cycleName: string | null }) {
  return (
    <PageContainer width="wide">
      <PerformancePageHeading title="My Team" size="display" />
      <div className="mt-8 flex flex-col items-center rounded-surface bg-card px-6 py-16 text-center ring-1 ring-inset ring-border">
        <Users className="size-8 text-muted-foreground" aria-hidden />
        <p className="mt-3 type-section-title text-foreground">
          {cycleName ? `No one reports to you in ${cycleName}` : "No one reports to you"}
        </p>
        <Button asChild variant="outline" className="mt-5">
          <Link href="/">Go to Overview</Link>
        </Button>
      </div>
    </PageContainer>
  );
}

/** Shape-matched page loading: display title, the phase facts and the roster. */
function TeamPageSkeleton() {
  return (
    <PageContainer width="wide">
      <div role="status" aria-label="Loading My Team">
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="mt-2 h-4 w-48" />
        <div className="mt-8 space-y-8">
          <Skeleton className="h-5 w-[32rem] max-w-full" />
          <RosterSkeleton />
          <TeamDirectionSkeleton />
        </div>
      </div>
    </PageContainer>
  );
}
