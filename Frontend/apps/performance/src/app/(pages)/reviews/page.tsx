"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "@/lib/icons";
import { PageContainer, PagePermissionNotice, PageSkeleton, StatusBadge } from "@repo/ds/shell";
import { useWorkspaceContext } from "@/features/performance/api/use-workspace";
import { useReviewHistory, useReviewRounds, useReviewWork } from "@/features/performance/api/use-reviews";
import { useCalibrationRounds } from "@/features/performance/api/use-calibration";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { PerformancePageHeading } from "@/features/performance/components/performance-page-heading";
import { composeReviewLanding } from "@/features/performance/components/reviews/reviews-model";
import { Button } from "@repo/ds/components/ui/button";
import { formatDate } from "@/features/performance/lib";
import { calibrationHref, newReviewRoundHref, reviewHref, roundHref, withCycle } from "@/lib/performance-routes";
import type { CalibrationRoundDto, PerformanceReviewState, ReviewHistoryItemDto, ReviewRoundSummaryDto, ReviewWorkItemDto } from "@repo/api";

export default function ReviewsPage() {
  const context = useWorkspaceContext();
  const cycle = context.data?.selected ?? null;
  const hasReviewDestination = context.data?.destinations.reviews ?? false;
  const isAdmin = context.data?.capabilities.administers ?? false;
  const work = useReviewWork(cycle?.id ?? null, hasReviewDestination);
  const rounds = useReviewRounds(cycle?.id ?? null, isAdmin && hasReviewDestination);
  const history = useReviewHistory(null, Boolean(context.data));
  const canCalibrate = context.data?.capabilities.canCalibrate ?? false;
  const calibration = useCalibrationRounds(cycle?.id ?? null, canCalibrate && hasReviewDestination);

  if (context.isLoading) return <PageSkeleton rows={5} width="wide" label="Loading Reviews" />;
  if (context.error) return <ContentUnavailable error={context.error} onRetry={context.refetch} subject="Reviews" />;
  if (history.error) return <ContentUnavailable error={history.error} onRetry={history.refetch} subject="Review history" />;
  if (!cycle && history.isLoading) return <PageSkeleton rows={4} width="wide" label="Loading review history" />;
  if (!cycle && history.data?.length) return (
    <PageContainer width="wide">
      <PerformancePageHeading title="Reviews" size="display" />
      <ReviewSection title="Completed across Cycles" count={history.data.length} empty="Completed reviews will be kept here.">
        {history.data.map((item) => <HistoryRow key={item.reviewId} item={item} isAdmin={isAdmin} />)}
      </ReviewSection>
    </PageContainer>
  );
  if (!cycle) return <PagePermissionNotice title="No Cycle selected" description="Reviews will appear when a Cycle is available." />;
  if (!hasReviewDestination && !history.data?.length) {
    return <PagePermissionNotice title="No reviews in this Cycle" description="Reviews appears when you have an assessment, review responsibility, or rounds to administer." />;
  }
  if (work.error) return <ContentUnavailable error={work.error} onRetry={work.refetch} subject="Reviews" />;
  if (isAdmin && rounds.error) return <ContentUnavailable error={rounds.error} onRetry={rounds.refetch} subject="Review rounds" />;
  if (canCalibrate && calibration.error) return <ContentUnavailable error={calibration.error} onRetry={calibration.refetch} subject="Calibration" />;

  const workItems = work.data ?? [];
  const landing = composeReviewLanding({
    work: workItems,
    rounds: rounds.data ?? [],
    history: history.data ?? [],
    isAdministrator: isAdmin,
  });

  if (work.isLoading || (isAdmin && rounds.isLoading) || (canCalibrate && calibration.isLoading) || history.isLoading) {
    return <PageSkeleton rows={5} width="wide" label="Loading review work" />;
  }

  return (
    <PageContainer width="wide">
      <PerformancePageHeading
        title="Reviews"
        size="display"
        actions={isAdmin ? <Button asChild><Link href={withCycle(newReviewRoundHref(), cycle.id)}>Start a review round</Link></Button> : null}
      />

      <div className="max-w-5xl divide-y divide-border">
        <ReviewSection
          title="Your review"
          count={landing.myReviews.length}
          empty="No review is waiting on you in this Cycle."
          emphasis={landing.myReviews.some((item) => item.isAssignedToCaller)}
        >
          {landing.myReviews.map((item) => <WorkRow key={item.reviewId} item={item} kind="subject" />)}
        </ReviewSection>

        <ReviewSection
          title="People you review"
          count={landing.reviewing.length}
          empty="No one is waiting on your assessment."
          emphasis={landing.reviewing.some((item) => item.isAssignedToCaller)}
        >
          {landing.reviewing.map((item) => <WorkRow key={item.reviewId} item={item} kind="reviewer" />)}
        </ReviewSection>

        {isAdmin ? (
          <ReviewSection title="Rounds you administer" count={landing.rounds.length} empty="No review rounds in this Cycle yet.">
            {landing.rounds.map((round) => <RoundRow key={round.id} round={round} />)}
          </ReviewSection>
        ) : null}

        {canCalibrate && calibration.data?.length ? (
          <ReviewSection title="Calibration" count={calibration.data.length} empty="No rounds use calibration in this Cycle." emphasis={calibration.data.some((item) => item.isFacilitator && item.sessionState === "Open")}>
            {calibration.data.map((item) => <CalibrationRow key={item.reviewRoundId} item={item} />)}
          </ReviewSection>
        ) : null}

        <ReviewSection title="Completed" count={landing.history.length} empty="Completed reviews will be kept here.">
          {landing.history.map((item) => <HistoryRow key={item.reviewId} item={item} isAdmin={isAdmin} />)}
        </ReviewSection>
      </div>
    </PageContainer>
  );
}

function ReviewSection({
  title,
  count,
  empty,
  emphasis = false,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  emphasis?: boolean;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`reviews-${title.toLowerCase().replaceAll(" ", "-")}`} className="py-6 first:pt-0">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 id={`reviews-${title.toLowerCase().replaceAll(" ", "-")}`} className="type-section-title text-foreground">{title}</h2>
        <span className="type-meta tabular-nums text-muted-foreground">{count}</span>
      </div>
      {count === 0 ? <p className="py-3 text-sm text-muted-foreground">{empty}</p> : (
        <ol className={emphasis ? "divide-y divide-border rounded-surface border border-border bg-card px-4" : "divide-y divide-border"}>
          {children}
        </ol>
      )}
    </section>
  );
}

function WorkRow({ item, kind }: { item: ReviewWorkItemDto; kind: "subject" | "reviewer" }) {
  const next = kind === "subject"
    ? item.state === "SelfAssessment" ? "Continue self-assessment" : "Waiting for your reviewer"
    : item.state === "ManagerAssessment" ? "Complete your assessment"
      : item.state === "SelfAssessment" ? "Waiting for their reflection" : "Submitted";
  const active = item.isAssignedToCaller;
  const title = kind === "subject" ? item.reviewRoundName : item.subjectDisplayName;
  const description = kind === "subject" ? `Reviewer · ${item.reviewerDisplayName}` : item.reviewRoundName;
  return (
    <li>
      <Link href={reviewHref(item.reviewId)} className="group flex min-h-16 flex-wrap items-center gap-x-5 gap-y-2 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="min-w-0 flex-1 basis-56">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="type-label text-foreground">{title}</span>
            <StatusBadge tone={toneForReviewState(item.state)}>{labelForReviewState(item.state)}</StatusBadge>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
            <span>{description}</span>
            {item.dueDate ? <span>Due {formatDate(item.dueDate)}</span> : null}
          </div>
        </div>
        <span className={active ? "inline-flex items-center gap-2 text-sm font-medium text-foreground" : "inline-flex items-center gap-2 text-sm text-muted-foreground"}>
          {next}<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </li>
  );
}

function RoundRow({ round }: { round: ReviewRoundSummaryDto }) {
  return (
    <li>
      <Link href={withCycle(roundHref(round.id), round.cycleId)} className="group flex min-h-16 flex-wrap items-center gap-x-5 gap-y-2 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="min-w-0 flex-1 basis-56">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="type-label text-foreground">{round.name}</span>
            <StatusBadge tone={round.state === "Active" ? "info" : round.state === "Closed" ? "muted" : "neutral"}>{round.state}</StatusBadge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{formatDate(round.periodStart)} – {formatDate(round.periodEnd)} · {round.subjectCount} people</p>
        </div>
        <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">Open round<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></span>
      </Link>
    </li>
  );
}

function CalibrationRow({ item }: { item: CalibrationRoundDto }) {
  const status = item.sessionState === null ? "Not started"
    : item.sessionState === "Finalized" ? "Finalized"
      : item.isFacilitator ? `${item.discussed ?? 0} of ${item.subjects ?? 0} discussed` : "In progress";
  const next = item.sessionState === null ? "Start calibration" : item.isFacilitator ? "Open calibration" : null;
  return (
    <li>
      <Link href={withCycle(calibrationHref(item.reviewRoundId), item.cycleId)} className="group flex min-h-16 flex-wrap items-center gap-x-5 gap-y-2 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="min-w-0 flex-1 basis-56">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="type-label text-foreground">{item.reviewRoundName}</span>
            <StatusBadge tone={item.sessionState === "Finalized" ? "success" : item.sessionState === "Open" ? "info" : "neutral"}>{item.sessionState === "Open" ? "Open" : item.sessionState ?? "Not started"}</StatusBadge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{status}{item.sessionState === "Open" && !item.isFacilitator ? " · You are not a facilitator" : ""}</p>
        </div>
        {next ? <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">{next}<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></span> : null}
      </Link>
    </li>
  );
}

function HistoryRow({ item, isAdmin }: { item: ReviewHistoryItemDto; isAdmin: boolean }) {
  return (
    <li>
      <Link href={reviewHref(item.reviewId)} className="group flex min-h-16 flex-wrap items-center gap-x-5 gap-y-2 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="min-w-0 flex-1 basis-56">
          <span className="type-label text-foreground">{isAdmin ? item.subjectDisplayName : item.reviewRoundName}</span>
          <p className="mt-1 text-sm text-muted-foreground">{item.cycleName} · {item.reviewRoundName} · {isAdmin ? item.reviewerDisplayName : "Finalized review"}</p>
        </div>
        {item.finalizedAt ? <span className="text-sm text-muted-foreground">{formatDate(item.finalizedAt)}</span> : null}
        {item.finalRatingLabel ? <span className="text-sm font-medium text-foreground">{item.finalRatingLabel}</span> : null}
        <StatusBadge tone="success">Finalized</StatusBadge>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

function toneForReviewState(state: PerformanceReviewState): "neutral" | "info" | "success" | "warning" | "muted" {
  if (state === "SelfAssessment" || state === "ManagerAssessment") return "warning";
  if (state === "Calibration") return "info";
  if (state === "Finalized") return "success";
  if (state === "Closed") return "muted";
  return "neutral";
}

function labelForReviewState(state: PerformanceReviewState) {
  switch (state) {
    case "SelfAssessment": return "Self-assessment";
    case "ManagerAssessment": return "Reviewer assessment";
    case "ReadyToFinalize": return "Ready to finalize";
    default: return state;
  }
}
