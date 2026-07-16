"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import {
  ApiError,
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
} from "@repo/api";
import type { CascadeCoverageCampaignDto, CascadeCoverageDto } from "@repo/api";
import { useApiQuery } from "@repo/api/query";
import { canViewPerformanceStrategy, useAuth } from "@repo/auth";
import {
  PageContainer,
  PageEmpty,
  PageError,
  PageHeader,
  PagePermissionNotice,
  StatusBadge,
} from "@repo/ds/shell";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/labels";
import { strategyTerms } from "@/components/campaigns/campaign-terminology";
import { CascadeCoverageFull } from "./cascade-coverage-section";
import { SegmentedCoverageBar } from "./cascade-visuals";

/** Direction door: launched campaigns whose strategy and cascade coverage can be viewed. */
export function StrategyCampaignsPage() {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const canView = canViewPerformanceStrategy(user);

  const { data, error, isLoading, refetch } = useApiQuery<
    CascadeCoverageCampaignDto[]
  >(
    performanceQueryKeys.cascadeCoverageCampaigns(),
    (signal) =>
      apiClient.get<CascadeCoverageCampaignDto[]>(
        performancePaths.cascadeCoverageCampaigns(),
        { signal }
      ),
    { enabled: canView }
  );

  if (authLoading) {
    return <StrategyListSkeleton />;
  }

  if (!canView) {
    return (
      <PageContainer>
        <PageHeader title={strategyTerms.listTitle} />
        <PagePermissionNotice title="Strategy access required" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={strategyTerms.listTitle} />

      {isLoading ? <StrategyListSkeleton /> : null}
      {!isLoading && error ? (
        <PageError
          title="Could not load campaigns"
          description="Try again."
          onRetry={refetch}
        />
      ) : null}

      {!isLoading && !error && data ? (
        data.length === 0 ? (
          <PageEmpty
            title={strategyTerms.emptyList.title}
            description={strategyTerms.emptyList.description}
          />
        ) : (
          <div className="space-y-3">
            {data.map((campaign, index) =>
              index === 0 ? (
                <StrategyCampaignHero key={campaign.id} campaign={campaign} />
              ) : (
                <StrategyCampaignRow key={campaign.id} campaign={campaign} />
              )
            )}
          </div>
        )
      ) : null}
    </PageContainer>
  );
}

/**
 * The lead campaign rendered with real presence: name at display weight and a *live* coverage
 * snapshot pulled for this campaign, so the door itself tells Direction where the gaps are before
 * they step through it.
 */
function StrategyCampaignHero({
  campaign,
}: {
  campaign: CascadeCoverageCampaignDto;
}) {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const { data } = useApiQuery<CascadeCoverageDto>(
    performanceQueryKeys.cascadeCoverage(campaign.slug),
    (signal) =>
      apiClient.get<CascadeCoverageDto>(
        performancePaths.cascadeCoverage(campaign.slug),
        { signal }
      ),
    { enabled: !!campaign.slug }
  );

  const gaps = data
    ? data.activeStrategicObjectiveCount - data.coveredStrategicObjectiveCount
    : 0;
  const segments =
    data?.strategicObjectives.map(
      (objective) => objective.teamObjectiveCount > 0
    ) ?? [];

  return (
    <Link
      href={`/strategy/${campaign.slug}`}
      className="group block rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {data && data.activeStrategicObjectiveCount > 0 ? (
              <StatusBadge tone={gaps > 0 ? "warning" : "success"} dot>
                {gaps > 0
                  ? strategyTerms.gapsToClose(gaps)
                  : strategyTerms.fullyCovered}
              </StatusBadge>
            ) : (
              <StatusBadge tone="success" dot>
                Launched
              </StatusBadge>
            )}
            {campaign.referenceYear ? (
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {campaign.referenceYear}
              </span>
            ) : null}
          </div>
          <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-foreground">
            {campaign.name}
          </h2>
          {campaign.launchedAt ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {strategyTerms.launchedOn(formatDate(campaign.launchedAt))}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-5 lg:w-[24rem] lg:shrink-0">
          <div className="min-w-0 flex-1">
            {data ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="font-heading text-4xl font-semibold leading-none tabular-nums tracking-tight text-foreground">
                    {data.coveredStrategicObjectiveCount}
                    <span className="text-2xl text-muted-foreground">
                      /{data.activeStrategicObjectiveCount}
                    </span>
                  </span>
                  <span className="text-xs leading-tight text-muted-foreground">
                    {strategyTerms.coveredNumeralLabel}
                  </span>
                </div>
                <SegmentedCoverageBar className="mt-3" segments={segments} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {data.teamObjectiveCount} {strategyTerms.teamObjectivesLabel}{" "}
                  ·{" "}
                  {strategyTerms.contributing(
                    data.managersWithTeamObjectivesCount,
                    data.managerCount
                  )}
                </p>
              </>
            ) : (
              <div className="space-y-2.5">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-2.5 w-full rounded-full" />
                <Skeleton className="h-3 w-40" />
              </div>
            )}
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

/** Secondary launched campaigns — a compact row; the lead hero carries the live snapshot. */
function StrategyCampaignRow({
  campaign,
}: {
  campaign: CascadeCoverageCampaignDto;
}) {
  return (
    <Link
      href={`/strategy/${campaign.slug}`}
      className="group flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-semibold text-foreground">
          {campaign.name}
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {campaign.referenceYear ? `${campaign.referenceYear} · ` : ""}
          {campaign.launchedAt
            ? strategyTerms.launchedOn(formatDate(campaign.launchedAt))
            : "Launched"}
        </p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/** Per-campaign strategy & cascade coverage — read-only, no admin affordances. */
export function StrategyCoveragePage() {
  const params = useParams<{ slug?: string }>();
  const slug = params.slug ?? "";
  const { user, isLoading: authLoading } = useAuth();
  const canView = canViewPerformanceStrategy(user);

  const apiClient = useMemo(() => createPlatformApiClient(), []);
  // One request serves the whole page: the coverage DTO already carries the
  // campaign's name and launch date alongside the coverage itself.
  const { data, error, isLoading, refetch } = useApiQuery<CascadeCoverageDto>(
    performanceQueryKeys.cascadeCoverage(slug),
    (signal) =>
      apiClient.get<CascadeCoverageDto>(
        performancePaths.cascadeCoverage(slug),
        { signal }
      ),
    { enabled: canView && !!slug }
  );

  if (authLoading) {
    return <StrategyCoverageSkeleton />;
  }

  if (!canView) {
    return (
      <PageContainer>
        <PageHeader title={strategyTerms.listTitle} />
        <PagePermissionNotice title="Strategy access required" />
      </PageContainer>
    );
  }

  if (isLoading) {
    return <StrategyCoverageSkeleton />;
  }

  if (error || !data) {
    // 404 = unknown slug; 400 = exists but not launched. Both mean there is no
    // strategy surface to show here.
    const status = error instanceof ApiError ? error.status : 0;
    const notFound = !error || status === 404 || status === 400;
    return (
      <PageContainer>
        <PageHeader title={strategyTerms.listTitle} />
        <PageError
          title={
            notFound ? "Campaign not found" : "Could not load this campaign"
          }
          description={
            notFound
              ? "It may not be launched yet, or the link is wrong."
              : "Try again."
          }
          onRetry={notFound ? undefined : refetch}
        />
      </PageContainer>
    );
  }

  const gaps =
    data.activeStrategicObjectiveCount - data.coveredStrategicObjectiveCount;

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          data.activeStrategicObjectiveCount > 0 ? (
            <StatusBadge tone={gaps > 0 ? "warning" : "success"} dot>
              {gaps > 0
                ? strategyTerms.gapsToClose(gaps)
                : strategyTerms.fullyCovered}
            </StatusBadge>
          ) : undefined
        }
        title={data.name}
        description={
          data.launchedAt
            ? `Launched ${formatDate(data.launchedAt)}`
            : undefined
        }
      />

      <CascadeCoverageFull data={data} />
    </PageContainer>
  );
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function StrategyListSkeleton() {
  return (
    <PageContainer>
      <div
        className="space-y-5"
        aria-busy
        aria-label="Loading strategy campaigns"
      >
        <Skeleton className="h-8 w-40" />
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="flex items-center gap-5 lg:w-[24rem]">
              <div className="flex-1 space-y-2.5">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-2.5 w-full rounded-full" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="size-5 shrink-0 rounded" />
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function StrategyCoverageSkeleton() {
  return (
    <PageContainer>
      <div
        className="space-y-5"
        aria-busy
        aria-label="Loading strategy coverage"
      >
        {/* Header */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-44" />
        </div>

        {/* Coverage banner: numeral + segmented bar + stats */}
        <div className="flex flex-col gap-6 rounded-xl border border-border bg-card px-6 py-5 sm:flex-row sm:items-center sm:gap-8">
          <div className="flex items-center gap-4 sm:w-52">
            <Skeleton className="h-12 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-2.5 w-full rounded-full" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="flex gap-8 sm:border-l sm:border-border sm:pl-8">
            <div className="space-y-2">
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-7 w-14" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        </div>

        {/* Two-column grid: collapsed lanes + managers rail */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="min-w-0 space-y-3">
            {[1, 2, 3, 4, 5].map((lane) => (
              <Skeleton key={lane} className="h-[4.75rem] rounded-xl" />
            ))}
          </div>

          <aside className="lg:sticky lg:top-4 lg:self-start">
            <div className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <Skeleton className="size-6 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-4 w-6" />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PageContainer>
  );
}
