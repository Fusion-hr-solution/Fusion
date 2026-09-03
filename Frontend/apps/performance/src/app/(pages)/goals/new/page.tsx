"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@repo/auth";
import { PageContainer, PagePermissionNotice } from "@repo/ds/shell";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { OrgObjectiveComposer } from "@/features/performance/components/goals/org-objective-composer";
import { ComposerSkeleton } from "@/features/performance/components/goals/composer-skeleton";
import { NotAlignmentBaseline } from "@/features/performance/components/goals/composer-notices";
import {
  useCurrentCycle,
  useGoal,
  usePerformanceAccess,
} from "@/features/performance/api/use-performance";
import { useWorkforceMe } from "@/features/performance/api/use-workforce-me";

export default function NewObjectivePage() {
  return (
    <Suspense fallback={<ComposerSkeleton />}>
      <NewObjectiveWorkspace />
    </Suspense>
  );
}

function NewObjectiveWorkspace() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const parentId = searchParams.get("parent");
  const scopeId = searchParams.get("scope");

  const access = usePerformanceAccess();
  const a = access.data;
  const canAuthor = (a?.canAdminister ?? false) || (a?.canManageOrgObjectives ?? false);

  const detail = useCurrentCycle(canAuthor);
  const cycle = detail.data?.cycle ?? null;
  const parent = useGoal(cycle?.id ?? null, canAuthor ? parentId : null);
  // Resolve the preselected scope's name from the actor's own workforce context. The scoped
  // landing only offers the actor's own organizational unit, so this is a self-service lookup —
  // no roster grant needed. If the hint doesn't match (or can't resolve), the picker stays empty.
  const me = useWorkforceMe(canAuthor && Boolean(scopeId));
  const org = me.data?.employee?.orgUnit;
  const defaultOrgUnit =
    scopeId && org && org.orgUnitId === scopeId
      ? { id: org.orgUnitId, name: org.name, path: [] }
      : null;

  if (access.isLoading) return <ComposerSkeleton />;
  if (!canAuthor) {
    return (
      <PagePermissionNotice
        title="Authoring not available"
        description="Creating organizational objectives is available to performance administration and organizational-objective managers."
      />
    );
  }
  if (detail.isLoading) return <ComposerSkeleton />;
  if (detail.error) return <ContentUnavailable error={detail.error} onRetry={detail.refetch} subject="The Cycle" />;
  if (!cycle) {
    return (
      <PageContainer>
        <PagePermissionNotice
          title="No Cycle yet"
          description="Objectives open once a Performance Cycle exists. Your administrator creates and activates it."
        />
      </PageContainer>
    );
  }
  if (!parentId) {
    return <NotAlignmentBaseline reason="missing" />;
  }
  if (parent.isLoading) return <ComposerSkeleton />;
  if (parent.error || !parent.data) {
    return (
      <ContentUnavailable
        error={parent.error ?? new Error("The parent objective could not be loaded.")}
        onRetry={parent.refetch}
        subject="The parent objective"
      />
    );
  }
  // A child can only align beneath a Published baseline — the server enforces this, so refuse the
  // composer up front rather than letting the author fill it in and fail on submit.
  if (!parent.data.node.isAlignmentBaseline) {
    return <NotAlignmentBaseline reason="draft" title={parent.data.node.title} />;
  }

  return (
    <OrgObjectiveComposer
      cycle={cycle}
      parent={parent.data.node}
      defaultAccountable={
        user?.employeeId ? { id: user.employeeId, name: user.fullName ?? "You" } : null
      }
      defaultOrgUnit={defaultOrgUnit}
    />
  );
}
