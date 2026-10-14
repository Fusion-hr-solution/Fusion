"use client";

import { Fragment } from "react";
import { PageContainer, PageSkeleton } from "@repo/ds/shell";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { PerformancePageHeading } from "@/features/performance/components/performance-page-heading";
import { useOverview, useWorkspaceContext } from "@/features/performance/api/use-workspace";
import { formatDate } from "@/features/performance/lib";
import { arrangeOverview, type OverviewBlock } from "@/features/performance/components/overview/overview-model";
import { CalibrationSection, MyReviewSection, ReviewOperationSection, TeamReviewsSection } from "@/features/performance/components/overview/review-sections";
import {
  MyPlanSection, MyRequestsSection,
  TeamDirectionSection,
  TeamSection,
} from "@/features/performance/components/overview/personal-sections";
import {
  ClosedCycleSection,
  CycleOperationSection,
  CycleStatusSection,
  DirectionSection,
  NoCycleSection,
  SetupSection,
} from "@/features/performance/components/overview/organization-sections";

/**
 * Overview: what state Performance is in, what needs this person, and where to go next. The server
 * composes the sections from the person's capabilities and recorded responsibility in the selected
 * Cycle; this page only renders them, and each one ends in a workspace or a record.
 */
export default function OverviewPage() {
  const context = useWorkspaceContext();
  const overview = useOverview(!context.isLoading && !context.error);

  if (context.isLoading) return <PageSkeleton rows={4} label="Loading Performance" />;
  if (context.error) return <ContentUnavailable error={context.error} onRetry={context.refetch} subject="Performance workspace" />;
  if (overview.error) {
    return <ContentUnavailable error={overview.error} onRetry={overview.refetch} subject="Overview" />;
  }
  if (!overview.data) return <PageSkeleton rows={4} label="Loading Overview" />;

  const { cycle, phase, sections } = overview.data;
  const cycleId = cycle?.id ?? "";

  const render = (block: OverviewBlock) => {
    switch (block.kind) {
      case "myPlan":
        return <MyPlanSection section={block} />;
      case "myReview":
        return <MyReviewSection section={block} />;
      case "myRequests":
        return <MyRequestsSection section={block} />;
      case "teamReviews":
        return <TeamReviewsSection section={block} />;
      case "reviewOperation":
        return <ReviewOperationSection section={block} />;
      case "calibration":
        return <CalibrationSection section={block} />;
      case "team":
        return <TeamSection planning={block.planning} execution={block.execution} />;
      case "teamDirection":
        return <TeamDirectionSection section={block} cycleId={cycleId} />;
      case "cycleOperation":
        return <CycleOperationSection section={block} />;
      case "direction":
        return <DirectionSection section={block} cycleId={cycleId} />;
      case "setupReadiness":
        return <SetupSection section={block} />;
      case "closedCycle":
        return <ClosedCycleSection section={block} />;
      case "noCycle":
        return <NoCycleSection section={block} />;
      case "cycleStatus":
        return <CycleStatusSection section={block} />;
    }
  };

  return (
    <PageContainer>
      <PerformancePageHeading
        title="Overview"
        size="display"
        // The cycle bar above names the cycle and its planning deadline; once planning has closed it
        // goes quiet, so the phase is stated here instead of repeated.
        description={cycle && phase === "Execution" ? `Execution until ${formatDate(cycle.endDate)}` : undefined}
      />
      <div className="mt-8 max-w-4xl space-y-8">
        {arrangeOverview(sections).map((block, index) => (
          <Fragment key={`${block.kind}-${index}`}>{render(block)}</Fragment>
        ))}
      </div>
    </PageContainer>
  );
}
