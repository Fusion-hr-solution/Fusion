"use client";

import { useMemo } from "react";
import {
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
} from "@repo/api";
import type {
  CascadeCoverageDto,
  CoverageStrategicObjectiveDto,
} from "@repo/api";
import { useApiQuery } from "@repo/api/query";
import { PageError, StatusBadge } from "@repo/ds/shell";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { measurementMethodLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { strategyTerms } from "@/components/campaigns/campaign-terminology";
import {
  AvatarCluster,
  CascadeRow,
  CoverageBanner,
  Leaf,
  LeafBody,
  PersonRow,
} from "./cascade-visuals";

/**
 * The read-only cascade coverage section HR reaches inside a launched campaign's workspace.
 * Direction's Strategy door renders the same truth through <CascadeCoverageFull/>, fed by the
 * same query. Coverage gaps are informational follow-up context — never blockers.
 */
export function CascadeCoverageSection({ slug }: { slug: string }) {
  const apiClient = useMemo(() => createPlatformApiClient(), []);

  const { data, error, isLoading, refetch } = useApiQuery<CascadeCoverageDto>(
    performanceQueryKeys.cascadeCoverage(slug),
    (signal) =>
      apiClient.get<CascadeCoverageDto>(
        performancePaths.cascadeCoverage(slug),
        { signal }
      ),
    { enabled: !!slug }
  );

  if (isLoading) {
    return <CoverageSkeleton />;
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
      <h2 className="text-sm font-semibold text-foreground">
        {strategyTerms.coverageTitle}
      </h2>
      <CascadeCoverageFull data={data} />
    </section>
  );
}

// ── The full cascade coverage surface (shared by Direction + HR) ─────────────

export function CascadeCoverageFull({ data }: { data: CascadeCoverageDto }) {
  const truncated = data.teamObjectives.length < data.teamObjectiveCount;
  const segments = data.strategicObjectives.map(
    (objective) => objective.teamObjectiveCount > 0
  );

  return (
    <div className="space-y-5">
      <CoverageBanner
        covered={data.coveredStrategicObjectiveCount}
        total={data.activeStrategicObjectiveCount}
        coveredLabel={strategyTerms.coveredNumeralLabel}
        segments={segments}
        coveredLegend={strategyTerms.coveredLegend}
        gapLegend={strategyTerms.gapLegend}
        stats={[
          {
            value: String(data.teamObjectiveCount),
            label: strategyTerms.teamObjectivesLabel,
          },
          {
            value: `${data.managersWithTeamObjectivesCount}/${data.managerCount}`,
            label: strategyTerms.managersContributing,
          },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-3">
          {data.strategicObjectives.map((strategicObjective) => (
            <CoverageLane
              key={strategicObjective.id}
              strategicObjective={strategicObjective}
              teamObjectives={data.teamObjectives.filter(
                (objective) =>
                  objective.strategicObjectiveId === strategicObjective.id
              )}
            />
          ))}
          {truncated ? (
            <p className="pl-4 text-xs text-muted-foreground">
              {strategyTerms.truncatedObjectives(
                data.teamObjectives.length,
                data.teamObjectiveCount
              )}
            </p>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <ManagersRail data={data} />
        </aside>
      </div>
    </div>
  );
}

function CoverageLane({
  strategicObjective,
  teamObjectives,
}: {
  strategicObjective: CoverageStrategicObjectiveDto;
  teamObjectives: CascadeCoverageDto["teamObjectives"];
}) {
  const covered = strategicObjective.teamObjectiveCount > 0;
  // Contributing managers on this objective, de-duplicated, for the collapsed row's face cluster.
  const contributors = Array.from(
    new Set(
      teamObjectives
        .map((objective) => objective.ownerManagerName)
        .filter(Boolean)
    )
  );

  return (
    <CascadeRow
      covered={covered}
      collapsible={covered}
      title={strategicObjective.title}
      description={strategicObjective.description}
      functionLabel={strategicObjective.responsibleFunctionLabel}
      status={
        <StatusBadge tone={covered ? "success" : "warning"} dot>
          {covered
            ? strategyTerms.objectiveCount(
                strategicObjective.teamObjectiveCount
              )
            : strategyTerms.needsObjective}
        </StatusBadge>
      }
      cluster={covered ? <AvatarCluster names={contributors} /> : undefined}
    >
      {covered ? <TeamObjectiveGroups teamObjectives={teamObjectives} /> : null}
    </CascadeRow>
  );
}

function TeamObjectiveGroups({
  teamObjectives,
}: {
  teamObjectives: CascadeCoverageDto["teamObjectives"];
}) {
  const groups = groupTeamObjectivesByManager(teamObjectives);

  return (
    <div className="pb-1">
      {groups.map((group) => (
        <section
          key={group.managerName}
          className="border-t border-border/70 first:border-t-0"
        >
          <div className="flex items-center justify-between gap-3 bg-background/50 px-10 py-2">
            <p className="truncate text-sm font-medium text-foreground">
              {group.managerName}
            </p>
            <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
              {strategyTerms.objectiveCount(group.objectives.length)}
            </span>
          </div>
          <ul>
            {group.objectives.map((objective, index) => (
              <Leaf
                key={objective.id}
                last={index === group.objectives.length - 1}
              >
                <LeafBody
                  title={objective.title}
                  successLabel={strategyTerms.successLabel}
                  successCriteria={objective.successCriteria}
                  measurementLabel={measurementMethodLabel(
                    objective.measurementMethod
                  )}
                />
              </Leaf>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function groupTeamObjectivesByManager(
  teamObjectives: CascadeCoverageDto["teamObjectives"]
) {
  const groups = new Map<string, CascadeCoverageDto["teamObjectives"]>();
  for (const objective of teamObjectives) {
    const key = objective.ownerManagerName || "Unassigned manager";
    groups.set(key, [...(groups.get(key) ?? []), objective]);
  }

  return Array.from(groups.entries())
    .map(([managerName, objectives]) => ({ managerName, objectives }))
    .sort(
      (a, b) =>
        b.objectives.length - a.objectives.length ||
        a.managerName.localeCompare(b.managerName)
    );
}

function ManagersRail({ data }: { data: CascadeCoverageDto }) {
  // Contributors first, then silent managers — the people who haven't cascaded yet are the follow-up.
  const managers = [...data.managers].sort(
    (a, b) =>
      b.teamObjectiveCount - a.teamObjectiveCount ||
      a.name.localeCompare(b.name)
  );
  const shown = managers.slice(0, 8);
  const overflow = managers.length - shown.length;

  return (
    <Card size="sm">
      <CardContent density="compact" className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {strategyTerms.managersHeading}
          </h2>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {strategyTerms.contributing(
              data.managersWithTeamObjectivesCount,
              data.managerCount
            )}
          </span>
        </div>
        <ul className="space-y-2.5">
          {shown.map((manager) => (
            <PersonRow
              key={manager.employeeId}
              name={manager.name}
              secondary={strategyTerms.managerScope(manager.scopeSize)}
              active={manager.teamObjectiveCount > 0}
              trailing={
                <span
                  className={cn(
                    "shrink-0 text-sm tabular-nums",
                    manager.teamObjectiveCount > 0
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground/60"
                  )}
                >
                  {manager.teamObjectiveCount}
                </span>
              }
            />
          ))}
        </ul>
        {overflow > 0 ? (
          <p className="pl-[2.375rem] text-xs text-muted-foreground">
            {strategyTerms.moreManagers(overflow)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CoverageSkeleton() {
  return (
    <section className="space-y-4">
      <Skeleton className="h-5 w-44" />
      <Skeleton className="h-[6.75rem] w-full rounded-xl" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[4.75rem] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </section>
  );
}
