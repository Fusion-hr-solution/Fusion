"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import {
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
  type TeamQueueDto,
  type TeamQueueItemDto,
} from "@repo/api";
import { useApiQuery } from "@repo/api/query";
import { canAccessTeamEvaluations, useAuth } from "@repo/auth";
import {
  PageContainer,
  PageEmpty,
  PageError,
  PageHeader,
  PageListSkeleton,
  PagePermissionNotice,
  StatusBadge,
} from "@repo/ds/shell";
import { UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/labels";
import { useBreadcrumbLabel } from "@/shell/breadcrumb-labels";
import {
  evaluationTerms,
  evaluationStateLabel,
  evaluationStateTone,
  queueGroupFor,
  QUEUE_GROUP_ORDER,
  type QueueGroupId,
} from "./evaluation-terms";

export function TeamQueuePage({ roundId }: { roundId: string }) {
  const api = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const allowed = canAccessTeamEvaluations(user);
  const query = useApiQuery<TeamQueueDto>(
    performanceQueryKeys.teamAssessmentQueue(roundId),
    (signal) =>
      api.get(performancePaths.teamAssessmentQueue(roundId), { signal }),
    { enabled: allowed }
  );

  useBreadcrumbLabel(roundId, query.data?.roundName);

  if (authLoading || (allowed && query.isLoading))
    return (
      <PageContainer width="wide">
        <PageListSkeleton />
      </PageContainer>
    );
  if (!allowed)
    return (
      <PageContainer>
        <PagePermissionNotice
          title={evaluationTerms.teamEvaluationsTitle}
          description={evaluationTerms.accessRequired}
        />
      </PageContainer>
    );
  if (query.error || !query.data)
    return (
      <PageContainer>
        <PageError title={evaluationTerms.loadFailed} onRetry={query.refetch} />
      </PageContainer>
    );

  const { items, roundName } = query.data;
  if (items.length === 0)
    return (
      <PageContainer width="wide">
        <PageHeader title={roundName} />
        <PageEmpty icon={UsersRound} title="No one to review" />
      </PageContainer>
    );

  const grouped = new Map<QueueGroupId, TeamQueueItemDto[]>();
  for (const item of items) {
    const group = queueGroupFor(item);
    const bucket = grouped.get(group) ?? [];
    bucket.push(item);
    grouped.set(group, bucket);
  }

  return (
    <PageContainer width="wide">
      <PageHeader title={roundName} />
      <div className="flex flex-col gap-8">
        {QUEUE_GROUP_ORDER.map((groupId) => {
          const bucket = grouped.get(groupId);
          if (!bucket || bucket.length === 0) return null;
          return (
            <section key={groupId} className="flex flex-col gap-3">
              <div className="flex items-baseline gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {evaluationTerms.queueGroups[groupId]}
                </h2>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {bucket.length}
                </span>
              </div>
              <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
                {bucket.map((item) => (
                  <QueueRow key={item.participantEmployeeId} roundId={roundId} item={item} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </PageContainer>
  );
}

function QueueRow({
  roundId,
  item,
}: {
  roundId: string;
  item: TeamQueueItemDto;
}) {
  return (
    <Link
      href={`/team-evaluations/${roundId}/${item.participantEmployeeId}`}
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        !item.actionable && "opacity-70"
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{item.participantName}</span>
          {item.materialDifferenceCount > 0 ? (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <AlertTriangle aria-hidden className="size-3" />
              {item.materialDifferenceCount}{" "}
              {evaluationTerms.materialDifference.toLowerCase()}
              {item.materialDifferenceCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">
          {item.nextAction}
          {item.deadline ? ` · due ${formatDate(item.deadline)}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge tone={evaluationStateTone(item.status)}>
          {evaluationStateLabel(item.status)}
        </StatusBadge>
        <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </div>
    </Link>
  );
}
