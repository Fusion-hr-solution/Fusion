"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ClipboardPenLine } from "lucide-react";
import {
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
  type MyEvaluationListItemDto,
  type MyEvaluationsPageDto,
} from "@repo/api";
import { useApiQuery } from "@repo/api/query";
import { canAccessMyEvaluations, useAuth } from "@repo/auth";
import {
  PageContainer,
  PageEmpty,
  PageError,
  PageHeader,
  PageListSkeleton,
  PagePermissionNotice,
  StatusBadge,
} from "@repo/ds/shell";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/labels";
import {
  evaluationTerms,
  evaluationStateLabel,
  evaluationStateTone,
  roundTypeLabel,
} from "./evaluation-terms";

const ACTIONABLE = new Set(["Not started", "In progress", "Finalized"]);

function isActionable(item: MyEvaluationListItemDto): boolean {
  return ACTIONABLE.has(item.status);
}

function href(roundId: string): string {
  return `/my-evaluations/${roundId}`;
}

export function MyEvaluationsPage() {
  const api = useMemo(() => createPlatformApiClient(), []);
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const allowed = canAccessMyEvaluations(user);
  const query = useApiQuery<MyEvaluationsPageDto>(
    performanceQueryKeys.myAssessments(),
    (signal) => api.get(performancePaths.myAssessments(), { signal }),
    { enabled: allowed }
  );

  // Single-round fast path: one round, land straight in it (redirect off-render).
  const page = query.data;
  const soleRoundId =
    page && page.totalCount === 1 && page.items.length === 1
      ? page.items[0]?.roundId
      : undefined;
  useEffect(() => {
    if (soleRoundId) router.replace(href(soleRoundId));
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
          title={evaluationTerms.myEvaluationsTitle}
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

  const items = query.data.items;

  // Redirect pending — show the skeleton rather than a flash of the list.
  if (soleRoundId)
    return (
      <PageContainer width="wide">
        <PageListSkeleton />
      </PageContainer>
    );

  if (items.length === 0)
    return (
      <PageContainer width="wide">
        <PageHeader title={evaluationTerms.myEvaluationsTitle} />
        <PageEmpty
          icon={ClipboardPenLine}
          title={evaluationTerms.noEvaluationWork}
        />
      </PageContainer>
    );

  const sorted = [...items].sort(
    (a, b) => Number(isActionable(b)) - Number(isActionable(a))
  );
  const lead = sorted[0];
  const rest = sorted.slice(1);
  if (!lead)
    return (
      <PageContainer width="wide">
        <PageHeader title={evaluationTerms.myEvaluationsTitle} />
        <PageEmpty
          icon={ClipboardPenLine}
          title={evaluationTerms.noEvaluationWork}
        />
      </PageContainer>
    );

  return (
    <PageContainer width="wide">
      <PageHeader title={evaluationTerms.myEvaluationsTitle} />
      <div className="flex flex-col gap-4">
        <LeadCard item={lead} />
        {rest.length > 0 ? (
          <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
            {rest.map((item) => (
              <EvaluationRow key={item.roundId} item={item} />
            ))}
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
}

function LeadCard({ item }: { item: MyEvaluationListItemDto }) {
  const actionable = isActionable(item);
  return (
    <Link
      href={href(item.roundId)}
      className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={evaluationStateTone(item.status)}>
          {evaluationStateLabel(item.status)}
        </StatusBadge>
        <span className="text-sm text-muted-foreground">
          {roundTypeLabel(item.roundType)}
        </span>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{item.roundName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.nextAction}
            {item.deadline ? ` · due ${formatDate(item.deadline)}` : ""}
          </p>
        </div>
        {item.finalRatingLabel ? (
          <div className="text-right">
            <span className="text-3xl font-semibold tabular-nums">
              {item.finalScore?.toFixed(1) ?? item.finalRatingOrdinal ?? "—"}
            </span>
            <p className="text-sm text-muted-foreground">
              {item.finalRatingLabel}
            </p>
          </div>
        ) : (
          <span
            className={cn(
              "flex items-center gap-1.5 text-sm font-medium",
              actionable ? "text-primary" : "text-muted-foreground"
            )}
          >
            {item.nextAction}
            <ArrowRight
              aria-hidden
              className="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </span>
        )}
      </div>
    </Link>
  );
}

function EvaluationRow({ item }: { item: MyEvaluationListItemDto }) {
  return (
    <Link
      href={href(item.roundId)}
      className="flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={evaluationStateTone(item.status)}>
            {evaluationStateLabel(item.status)}
          </StatusBadge>
          <span className="truncate font-medium">{item.roundName}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {roundTypeLabel(item.roundType)}
          {item.deadline ? ` · due ${formatDate(item.deadline)}` : ""}
        </span>
      </div>
      {item.finalRatingLabel ? (
        <span className="shrink-0 text-sm font-medium tabular-nums">
          {item.finalScore?.toFixed(1) ?? item.finalRatingOrdinal} ·{" "}
          {item.finalRatingLabel}
        </span>
      ) : (
        <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      )}
    </Link>
  );
}
