"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Archive, CalendarCheck2, Users } from "lucide-react";
import {
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
  type PagedResponse,
  type PerformanceCycleSummaryDto,
} from "@repo/api";
import { useApiQuery } from "@repo/api/query";
import { useAuth } from "@repo/auth";
import { canViewPerformanceCampaigns } from "@repo/auth";
import {
  PageContainer,
  PageEmpty,
  PageError,
  PageHeader,
  PagePermissionNotice,
  PageSkeleton,
} from "@repo/ds/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { campaignClosure, campaignTerms } from "./campaign-terminology";
import { formatDate } from "@/lib/labels";

/**
 * The closed-campaign record.
 *
 * A deliberate, separate door rather than a filter on the active list: the spec forbids
 * intermixing settled records with day-to-day work, and a distinct entry point is the honest way to
 * say "this is history". Reuses the campaign-viewer rule rather than introducing a new one, and
 * renders no write affordance anywhere — every campaign here is terminal.
 */
export function CampaignHistoryPage() {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const canView = canViewPerformanceCampaigns(user);

  const { data, error, isLoading, refetch } = useApiQuery<
    PagedResponse<PerformanceCycleSummaryDto>
  >(
    performanceQueryKeys.cycleList({ page: 1, pageSize: 100 }),
    (signal) =>
      apiClient.get<PagedResponse<PerformanceCycleSummaryDto>>(
        performancePaths.cycles(),
        { signal, params: { page: 1, pageSize: 100 } },
      ),
    { enabled: canView },
  );

  const closed = useMemo(
    () =>
      (data?.items ?? [])
        .filter((campaign) => campaign.status === "Closed")
        .sort((left, right) =>
          (right.closedAt ?? "").localeCompare(left.closedAt ?? ""),
        ),
    [data],
  );

  if (authLoading) {
    return <CampaignHistoryLoading />;
  }

  if (!canView) {
    return (
      <PageContainer>
        <PageHeader title={campaignClosure.historyTitle} />
        <PagePermissionNotice title="Campaign access required" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={campaignClosure.historyTitle}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/campaigns">{campaignTerms.listTitle}</Link>
          </Button>
        }
      />

      {isLoading ? <PageSkeleton /> : null}

      {!isLoading && error ? (
        <PageError
          title="Could not load campaign history"
          description="Try again."
          onRetry={refetch}
        />
      ) : null}

      {!isLoading && !error ? (
        closed.length === 0 ? (
          <PageEmpty
            title={campaignClosure.historyEmpty.title}
            description={campaignClosure.historyEmpty.description}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {closed.map((campaign) => (
              <li key={campaign.id}>
                <ClosedCampaignCard campaign={campaign} />
              </li>
            ))}
          </ul>
        )
      ) : null}
    </PageContainer>
  );
}

/**
 * One settled campaign. The closure date carries the visual weight — it is what distinguishes one
 * archived cycle from another. Navigates to the read-only workspace; nothing here writes.
 */
function ClosedCampaignCard({
  campaign,
}: {
  campaign: PerformanceCycleSummaryDto;
}) {
  return (
    <Link
      href={`/campaigns/${campaign.slug}`}
      className="group flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Wraps to two lines rather than truncating: a campaign's name is how someone
              recognises the year they are looking for, so losing its tail defeats the card. */}
          <p className="line-clamp-2 font-heading text-base font-semibold tracking-tight text-foreground">
            {campaign.name}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {campaign.referenceYear}
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 gap-1.5">
          <Archive className="size-3.5" aria-hidden />
          {campaignClosure.status}
        </Badge>
      </div>

      <dl className="mt-auto space-y-1.5 text-sm">
        <div className="flex items-center gap-2">
          <CalendarCheck2
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <dt className="sr-only">Closed</dt>
          <dd className="font-medium tabular-nums text-foreground">
            {campaign.closedAt
              ? campaignClosure.closedOn(formatDate(campaign.closedAt))
              : campaignClosure.status}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <Users
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <dt className="sr-only">Participants</dt>
          <dd className="tabular-nums text-muted-foreground">
            {campaign.participantCount.toLocaleString()}
          </dd>
        </div>
      </dl>
    </Link>
  );
}

export function CampaignHistoryLoading() {
  return (
    <PageContainer>
      <PageHeader title={campaignClosure.historyTitle} />
      <PageSkeleton />
    </PageContainer>
  );
}
