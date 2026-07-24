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
import { formatDate, initials } from "@/lib/labels";
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

  const attention =
    (grouped.get("readyToFinalize")?.length ?? 0) +
    (grouped.get("inAssessment")?.length ?? 0);
  const done = grouped.get("done")?.length ?? 0;

  return (
    <PageContainer width="wide">
      <PageHeader
        title={roundName}
        eyebrow={
          <span className="text-sm text-muted-foreground">
            {items.length} to review · {attention} need you · {done} done
          </span>
        }
      />
      <div className="flex flex-col gap-6">
        {QUEUE_GROUP_ORDER.map((groupId) => {
          const bucket = grouped.get(groupId);
          if (!bucket || bucket.length === 0) return null;
          const muted = groupId === "awaitingEmployee" || groupId === "done";
          return (
            <section key={groupId} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 px-1">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {evaluationTerms.queueGroups[groupId]}
                </h2>
                <span className="text-xs tabular-nums text-muted-foreground/70">
                  {bucket.length}
                </span>
              </div>
              <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
                {bucket.map((item) => (
                  <QueueRow
                    key={item.participantEmployeeId}
                    roundId={roundId}
                    item={item}
                    muted={muted}
                  />
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
  muted,
}: {
  roundId: string;
  item: TeamQueueItemDto;
  muted: boolean;
}) {
  return (
    <Link
      href={`/team-evaluations/${roundId}/${item.participantEmployeeId}`}
      className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <span
        aria-hidden
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          muted
            ? "bg-muted text-muted-foreground"
            : "bg-primary/15 text-primary"
        )}
      >
        {initials(item.participantName)}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">
        {item.participantName}
      </span>
      {item.materialDifferenceCount > 0 ? (
        <span
          className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300"
          title={`${item.materialDifferenceCount} material difference${item.materialDifferenceCount === 1 ? "" : "s"}`}
        >
          <AlertTriangle aria-hidden className="size-3" />
          {item.materialDifferenceCount}
        </span>
      ) : null}
      {item.deadline ? (
        <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:inline">
          {formatDate(item.deadline)}
        </span>
      ) : null}
      <StatusBadge tone={evaluationStateTone(item.status)}>
        {evaluationStateLabel(item.status)}
      </StatusBadge>
      <ArrowRight
        aria-hidden
        className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
