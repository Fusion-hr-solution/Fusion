"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, UsersRound } from "lucide-react";
import {
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
  type EvaluationWorkEntryDto,
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
import { formatDate } from "@/lib/labels";
import { evaluationTerms } from "./evaluation-terms";

interface RoundSummary {
  roundId: string;
  name: string;
  operationalState: string;
  managerDeadline: string | null;
  assignmentCount: number;
}

function summarize(entries: EvaluationWorkEntryDto[]): RoundSummary[] {
  const byRound = new Map<string, RoundSummary>();
  for (const entry of entries) {
    const round = entry.round.round;
    const existing = byRound.get(round.id);
    if (existing) {
      existing.assignmentCount += 1;
    } else {
      byRound.set(round.id, {
        roundId: round.id,
        name: round.name,
        operationalState: round.operationalState,
        managerDeadline: round.managerAssessmentDeadline,
        assignmentCount: 1,
      });
    }
  }
  return [...byRound.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function TeamEvaluationsPage() {
  const api = useMemo(() => createPlatformApiClient(), []);
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const allowed = canAccessTeamEvaluations(user);
  const query = useApiQuery<EvaluationWorkEntryDto[]>(
    performanceQueryKeys.teamEvaluationAssignments(),
    (signal) =>
      api.get(performancePaths.teamEvaluationAssignments(), { signal }),
    { enabled: allowed }
  );

  // Single-round fast path: land straight in the only round's queue (redirect off-render).
  const rounds = query.data ? summarize(query.data) : [];
  const soleRoundId = rounds.length === 1 ? rounds[0]?.roundId : undefined;
  useEffect(() => {
    if (soleRoundId) router.replace(`/team-evaluations/${soleRoundId}`);
  }, [soleRoundId, router]);

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

  // Redirect pending — show the skeleton rather than a flash of the list.
  if (soleRoundId)
    return (
      <PageContainer width="wide">
        <PageListSkeleton />
      </PageContainer>
    );

  if (rounds.length === 0)
    return (
      <PageContainer width="wide">
        <PageHeader title={evaluationTerms.teamEvaluationsTitle} />
        <PageEmpty icon={UsersRound} title={evaluationTerms.noTeamRounds} />
      </PageContainer>
    );

  return (
    <PageContainer width="wide">
      <PageHeader title={evaluationTerms.teamEvaluationsTitle} />
      <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
        {rounds.map((round) => (
          <Link
            key={round.roundId}
            href={`/team-evaluations/${round.roundId}`}
            className="flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  tone={
                    round.operationalState === "Overdue"
                      ? "danger"
                      : round.operationalState === "Completed"
                        ? "success"
                        : "info"
                  }
                >
                  {round.operationalState.replace(/([A-Z])/g, " $1").trim()}
                </StatusBadge>
                <span className="truncate font-medium">{round.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {round.assignmentCount} to review
                {round.managerDeadline
                  ? ` · due ${formatDate(round.managerDeadline)}`
                  : ""}
              </span>
            </div>
            <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </PageContainer>
  );
}
