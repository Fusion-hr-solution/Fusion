"use client";

import { useParams } from "next/navigation";
import { PagePermissionNotice } from "@repo/ds/shell";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { OrgObjectiveComposer } from "@/features/performance/components/goals/org-objective-composer";
import { ComposerSkeleton } from "@/features/performance/components/goals/composer-skeleton";
import { NotEditable } from "@/features/performance/components/goals/composer-notices";
import { PerformanceBreadcrumbLabel } from "@/shell/performance-breadcrumb";
import {
  useCurrentCycle,
  useGoal,
  usePerformanceAccess,
} from "@/features/performance/api/use-performance";

export default function EditObjectivePage() {
  const params = useParams<{ objectiveId: string }>();
  const objectiveId = params.objectiveId;

  const access = usePerformanceAccess();
  const a = access.data;
  const canAuthor = (a?.canAdminister ?? false) || (a?.canManageOrgObjectives ?? false);

  const detail = useCurrentCycle(canAuthor);
  const cycle = detail.data?.cycle ?? null;
  const goal = useGoal(cycle?.id ?? null, canAuthor ? objectiveId : null);

  if (access.isLoading) return <ComposerSkeleton />;
  if (!canAuthor) {
    return (
      <PagePermissionNotice
        title="Authoring not available"
        description="Editing organizational objectives is available to performance administration and organizational-objective managers."
      />
    );
  }
  if (detail.isLoading || (cycle && goal.isLoading)) return <ComposerSkeleton />;
  if (detail.error) return <ContentUnavailable error={detail.error} onRetry={detail.refetch} subject="The Cycle" />;
  if (!cycle) {
    return <PagePermissionNotice title="No Cycle yet" description="Objectives open once a Performance Cycle exists." />;
  }
  if (goal.error || !goal.data) {
    return (
      <ContentUnavailable
        error={goal.error ?? new Error("The objective could not be loaded.")}
        onRetry={goal.refetch}
        subject="The objective"
      />
    );
  }

  const objective = goal.data;
  const isOrg = objective.node.ownershipScope === "OrgUnit";
  if (!isOrg || !objective.parent || !objective.canEdit) {
    return <NotEditable published={objective.node.state === "Published"} />;
  }

  return (
    <>
      {/* Replace the raw UUID segment in the shell breadcrumb with the objective's title. */}
      <PerformanceBreadcrumbLabel segment={objectiveId} label={objective.node.title} />
      <OrgObjectiveComposer cycle={cycle} parent={objective.parent} objective={objective} />
    </>
  );
}
