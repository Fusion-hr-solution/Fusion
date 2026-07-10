"use client";

import { useMemo } from "react";
import { GitBranch, Target, Users } from "lucide-react";
import {
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
} from "@repo/api";
import type { CascadeCoverageDto } from "@repo/api";
import { useApiQuery } from "@repo/api/query";
import { PageError } from "@repo/ds/shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, measurementMethodLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { strategyTerms } from "@/components/campaigns/campaign-terminology";

/**
 * The shared read-only cascade coverage surface for a launched campaign. One truth, two
 * doors: HR reaches it inside the campaign workspace, Direction through the Strategy entry.
 * Coverage gaps are informational follow-up context — never blockers.
 */
export function CascadeCoverageSection({ slug }: { slug: string }) {
  const apiClient = useMemo(() => createPlatformApiClient(), []);

  const { data, error, isLoading, refetch } = useApiQuery<CascadeCoverageDto>(
    performanceQueryKeys.cascadeCoverage(slug),
    (signal) =>
      apiClient.get<CascadeCoverageDto>(performancePaths.cascadeCoverage(slug), { signal }),
    { enabled: !!slug },
  );

  if (isLoading) {
    return (
      <section className="space-y-3">
        <Skeleton className="h-5 w-44" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <PageError
        title="Could not load cascade coverage"
        description="Try again."
        onRetry={refetch}
      />
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{strategyTerms.coverageTitle}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{strategyTerms.coverageCaption}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <CoverageIndicator
          icon={<GitBranch className="size-4" />}
          value={`${data.coveredStrategicObjectiveCount}/${data.activeStrategicObjectiveCount}`}
          label={strategyTerms.pillarsCovered(
            data.coveredStrategicObjectiveCount,
            data.activeStrategicObjectiveCount,
          )}
          complete={
            data.activeStrategicObjectiveCount > 0 &&
            data.coveredStrategicObjectiveCount === data.activeStrategicObjectiveCount
          }
        />
        <CoverageIndicator
          icon={<Users className="size-4" />}
          value={`${data.managersWithTeamObjectivesCount}/${data.managerCount}`}
          label={strategyTerms.managersContributing(
            data.managersWithTeamObjectivesCount,
            data.managerCount,
          )}
          complete={
            data.managerCount > 0 && data.managersWithTeamObjectivesCount === data.managerCount
          }
        />
        <CoverageIndicator
          icon={<Target className="size-4" />}
          value={String(data.teamObjectiveCount)}
          label={strategyTerms.teamObjectivesTotal(data.teamObjectiveCount)}
          complete={data.teamObjectiveCount > 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card size="sm">
          <CardContent density="compact" className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              {strategyTerms.pillarsHeading}
            </h3>
            <ul className="space-y-2.5">
              {data.strategicObjectives.map((pillar) => (
                <li key={pillar.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{pillar.title}</p>
                    {pillar.responsibleFunctionLabel ? (
                      <p className="text-xs text-muted-foreground">
                        {pillar.responsibleFunctionLabel}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-sm tabular-nums",
                      pillar.teamObjectiveCount > 0
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {pillar.teamObjectiveCount > 0
                      ? strategyTerms.teamObjectivesTotal(pillar.teamObjectiveCount)
                      : strategyTerms.noObjectivesYet}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent density="compact" className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              {strategyTerms.managersHeading}
            </h3>
            <ul className="space-y-2.5">
              {data.managers.map((manager) => (
                <li key={manager.employeeId} className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{manager.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {strategyTerms.managerScope(manager.scopeSize)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-sm tabular-nums",
                      manager.teamObjectiveCount > 0
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {manager.teamObjectiveCount > 0
                      ? strategyTerms.teamObjectivesTotal(manager.teamObjectiveCount)
                      : strategyTerms.noObjectivesYet}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">{strategyTerms.followUpHint}</p>
          </CardContent>
        </Card>
      </div>

      {data.teamObjectives.length > 0 ? (
        <Card size="sm">
          <CardContent density="compact" className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              {strategyTerms.allObjectivesHeading}
            </h3>
            <ul className="divide-y divide-border">
              {data.teamObjectives.map((objective) => (
                <li key={objective.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{objective.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {objective.successCriteria}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {objective.ownerManagerName} · {objective.strategicObjectiveTitle}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {measurementMethodLabel(objective.measurementMethod)}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

function CoverageIndicator({
  icon,
  value,
  label,
  complete,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  complete: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div
        className={cn(
          "flex items-center gap-2",
          complete ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {icon}
        <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
