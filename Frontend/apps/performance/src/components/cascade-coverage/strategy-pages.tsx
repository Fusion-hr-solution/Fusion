"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { CalendarClock, ChevronRight } from "lucide-react";
import {
  ApiError,
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
} from "@repo/api";
import type { CascadeCoverageCampaignDto } from "@repo/api";
import { useApiQuery } from "@repo/api/query";
import { canViewPerformanceStrategy, useAuth } from "@repo/auth";
import {
  PageContainer,
  PageEmpty,
  PageError,
  PageHeader,
  PagePermissionNotice,
  PageSkeleton,
} from "@repo/ds/shell";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/labels";
import { strategyTerms } from "@/components/campaigns/campaign-terminology";
import { CascadeCoverageSection } from "./cascade-coverage-section";

/** Direction door: launched campaigns whose strategy and cascade coverage can be viewed. */
export function StrategyCampaignsPage() {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const canView = canViewPerformanceStrategy(user);

  const { data, error, isLoading, refetch } = useApiQuery<CascadeCoverageCampaignDto[]>(
    performanceQueryKeys.cascadeCoverageCampaigns(),
    (signal) =>
      apiClient.get<CascadeCoverageCampaignDto[]>(
        performancePaths.cascadeCoverageCampaigns(),
        { signal },
      ),
    { enabled: canView },
  );

  if (authLoading) {
    return <PageSkeleton />;
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

      {isLoading ? <PageSkeleton /> : null}
      {!isLoading && error ? (
        <PageError title="Could not load campaigns" description="Try again." onRetry={refetch} />
      ) : null}

      {!isLoading && !error && data ? (
        data.length === 0 ? (
          <PageEmpty
            title={strategyTerms.emptyList.title}
            description={strategyTerms.emptyList.description}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/strategy/${campaign.slug}`}
                className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {campaign.referenceYear ? (
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {campaign.referenceYear}
                      </p>
                    ) : null}
                    <h3 className="mt-0.5 truncate text-base font-semibold text-foreground">
                      {campaign.name}
                    </h3>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <Separator className="my-4" />
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarClock className="size-3.5" />
                  {campaign.launchedAt
                    ? `Launched ${formatDate(campaign.launchedAt)}`
                    : "Launched"}
                </p>
              </Link>
            ))}
          </div>
        )
      ) : null}
    </PageContainer>
  );
}

/** Per-campaign strategy & cascade coverage — read-only, no admin affordances. */
export function StrategyCoveragePage() {
  const params = useParams<{ slug?: string }>();
  const slug = params.slug ?? "";
  const { user, isLoading: authLoading } = useAuth();
  const canView = canViewPerformanceStrategy(user);

  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const { data, error, isLoading, refetch } = useApiQuery<CascadeCoverageCampaignDto[]>(
    performanceQueryKeys.cascadeCoverageCampaigns(),
    (signal) =>
      apiClient.get<CascadeCoverageCampaignDto[]>(
        performancePaths.cascadeCoverageCampaigns(),
        { signal },
      ),
    { enabled: canView && !!slug },
  );

  if (authLoading) {
    return <PageSkeleton />;
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
    return <PageSkeleton />;
  }

  const campaign = data?.find((item) => item.slug === slug);

  if (error || !campaign) {
    const notFound = !error || (error instanceof ApiError && error.status === 404) || !campaign;
    return (
      <PageContainer>
        <PageHeader title={strategyTerms.listTitle} />
        <PageError
          title={notFound ? "Campaign not found" : "Could not load this campaign"}
          description={
            notFound ? "It may not be launched yet, or the link is wrong." : "Try again."
          }
          onRetry={notFound ? undefined : refetch}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={campaign.name}
        description={
          campaign.launchedAt ? `Launched ${formatDate(campaign.launchedAt)}` : undefined
        }
      />

      <CascadeCoverageSection slug={slug} />
    </PageContainer>
  );
}
