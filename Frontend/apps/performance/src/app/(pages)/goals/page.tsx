"use client";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@repo/ds/components/ui/button";
import { useOrgHierarchy } from "@repo/workforce-ui";
import { PageContainer, PageError, PagePermissionNotice, PageSkeleton } from "@repo/ds/shell";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { CycleContextBar } from "@/features/performance/components/cycle-context-bar";
import { PerformancePageHeading } from "@/features/performance/components/performance-page-heading";
import { ObjectiveContextPanel } from "@/features/performance/components/goals/objective-context-panel";
import { ObjectiveWorkspace } from "@/features/performance/components/goals/objective-workspace";
import {
  OrgComposerHost,
  type ComposerState,
} from "@/features/performance/components/goals/org-composer-host";
import {
  CompanyComposerHost,
  type CompanyComposerState,
} from "@/features/performance/components/goals/company-composer-host";
import {
  scopeUnitsFromTree,
  WorkingScopeSelector,
} from "@/features/performance/components/goals/working-scope-selector";
import { type UnitContext } from "@/features/performance/components/goals/working-context-lib";
import {
  usePerformanceAccess,
  useCurrentCycle,
  useGoals,
  useGoalMutations,
  useSaveStrategy,
} from "@/features/performance/api/use-performance";
import {
  useWorkforceMe,
} from "@/features/performance/api/use-workforce-me";

export default function GoalsPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={4} label="Loading goals" />}>
      <GoalsWorkspace />
    </Suspense>
  );
}

function GoalsWorkspace() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const access = usePerformanceAccess();
  const a = access.data;
  const scope = a?.aggregateViewScope ?? null;
  const hasOrgRead = scope === "DirectReports" || scope === "OrgUnit" || scope === "Tenant";
  // Organization Goals is an organization-direction surface, not a universal employee destination:
  // it opens for organizational/strategic/admin responsibility or organizational read authority.
  // Ordinary Self-only participants reach direction through Overview, not here.
  const canViewOrgGoals =
    (a?.canAdminister ?? false) ||
    (a?.canPublishStrategy ?? false) ||
    (a?.canManageOrgObjectives ?? false) ||
    hasOrgRead;
  // Authority (not placement) decides the default context. A tenant-wide actor (administration, or
  // tenant-breadth read) is responsible for the whole organization, so they land organization-wide;
  // everyone else is centered on the unit they actually belong to. Both drill the same hierarchy.
  const broad = (a?.canAdminister ?? false) || scope === "Tenant";
  const canReachSetup = (a?.canAdminister ?? false) || (a?.canPublishStrategy ?? false);
  const requestedScopeId = searchParams.get("scope");
  const focusId = searchParams.get("focus");

  const detail = useCurrentCycle(canViewOrgGoals);
  const cycle = detail.data?.cycle ?? null;
  const goals = useGoals(cycle?.id ?? null, canViewOrgGoals);
  // The actor's own organizational context — resolved from real workforce data, never fabricated.
  // Fetched for every actor who can be here (not just non-broad ones) so a broad actor with a real
  // placement can narrow the working scope to their own unit (§33). Absent for a placement-less admin.
  const me = useWorkforceMe(canViewOrgGoals);
  // A CoreHR tree is fetched only for broad viewers who can actually switch organizational context.
  // Managers stay within their workforce placement, even if the MVP's coarse permission happens to
  // be technically wider.
  const organization = useOrgHierarchy(canViewOrgGoals && broad);
  // Mutation hooks live above every early return so hook order is stable; they no-op until invoked and
  // the id is only meaningful once the Cycle resolves.
  const goalMutations = useGoalMutations(cycle?.id ?? "");
  const strategyMutations = useSaveStrategy(cycle?.id ?? "");

  // The branch to reveal after a mutation — the parent of a just-created/edited objective.
  const [revealId, setRevealId] = useState<string | null>(null);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [companyComposer, setCompanyComposer] = useState<CompanyComposerState | null>(null);

  const ownUnit: UnitContext | null = useMemo(() => {
    const org = me.data?.employee?.orgUnit;
    if (!org) return null;
    return {
      orgUnitId: org.orgUnitId,
      name: org.name,
      type: org.type,
      path: org.path,
      memberCount: me.data?.orgUnitMemberCount ?? null,
      isOwnUnit: true,
    };
  }, [me.data]);

  const scopeUnits = useMemo(
    () => scopeUnitsFromTree(organization.data?.roots ?? []),
    [organization.data],
  );
  const selectedScope = useMemo(
    () =>
      requestedScopeId
        ? scopeUnits.find((unit) => unit.id === requestedScopeId) ?? null
        : null,
    [requestedScopeId, scopeUnits],
  );
  const workingUnit: UnitContext | null = broad
    ? selectedScope
      ? {
          orgUnitId: selectedScope.id,
          name: selectedScope.name,
          type: selectedScope.type,
          path: selectedScope.path,
          memberCount: selectedScope.memberCount,
          isOwnUnit: selectedScope.id === ownUnit?.orgUnitId,
        }
      : null
    : ownUnit;
  const organizationWide = broad && workingUnit === null;

  const replaceContext = (next: { focusId?: string | null; scopeId?: string | null }) => {
    const query = new URLSearchParams(searchParams.toString());
    if (next.focusId !== undefined) {
      if (next.focusId) query.set("focus", next.focusId);
      else query.delete("focus");
    }
    if (next.scopeId !== undefined) {
      if (next.scopeId) query.set("scope", next.scopeId);
      else query.delete("scope");
    }
    router.replace(`${pathname}${query.size ? `?${query.toString()}` : ""}`, {
      scroll: false,
    });
  };

  if (access.isLoading) return <PageSkeleton rows={4} label="Loading Performance" />;
  if (!canViewOrgGoals) {
    return <PagePermissionNotice title="No Organization Goals access" description="Organization Goals is available to leadership and performance administration." />;
  }
  if (detail.isLoading) return <PageSkeleton rows={4} label="Loading Cycle" />;
  if (detail.error) return <ContentUnavailable error={detail.error} onRetry={detail.refetch} subject="The Cycle" />;
  if (!cycle) {
    return (
      <PageContainer>
        <PagePermissionNotice
          title="No Cycle yet"
          description="Goals open once a Performance Cycle exists. Your administrator creates and activates it."
        />
      </PageContainer>
    );
  }

  // Authoring organizational objectives is governed by organizational-scope management authority
  // (governed admin, or the org-manage grant). The precise per-org-unit check is enforced
  // server-side when the unit is chosen, so this only decides whether to offer the affordance.
  const canAuthorOrgObjectives = (a?.canAdminister ?? false) || (a?.canManageOrgObjectives ?? false);
  // Company (strategic) direction — create / edit / publish — is the strategy-publish authority.
  const canManageCompany = (a?.canAdminister ?? false) || (a?.canPublishStrategy ?? false);

  async function handleDeleteOrg(objectiveId: string) {
    try {
      await goalMutations.remove.mutateAsync(objectiveId);
      toast.success("Draft objective removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the objective.");
    }
  }

  async function handlePublishCompany(objectiveId: string) {
    try {
      await strategyMutations.publish.mutateAsync(objectiveId);
      toast.success("Published as company direction.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish the objective.");
    }
  }

  const overview = goals.data;
  const meResolving = !broad && me.isLoading;

  const actions = overview ? (
    <>
      {broad ? (
        <WorkingScopeSelector
          roots={organization.data?.roots ?? []}
          value={requestedScopeId}
          loading={organization.isLoading}
          onChange={(scopeId) => replaceContext({ scopeId, focusId: null })}
        />
      ) : null}
      {canManageCompany ? (
        <Button size="sm" onClick={() => setCompanyComposer({ mode: "create" })}>
          <Plus className="size-4" data-icon="inline-start" /> Create company objective
        </Button>
      ) : null}
    </>
  ) : undefined;

  return (
    <PageContainer>
      <PerformancePageHeading
        title="Organization Goals"
        description="Explore and manage the organizational goals that drive performance."
        actions={actions}
      />
      <CycleContextBar cycle={cycle} compact />

      {goals.isLoading || meResolving ? (
        <PageSkeleton rows={4} label="Loading goals" />
      ) : goals.error || !overview ? (
        <PageError title="Goals unavailable" description={goals.error?.message} onRetry={goals.refetch} />
      ) : (
        <ObjectiveWorkspace
          cycleId={cycle.id}
          overview={overview}
          focusId={focusId}
          revealId={revealId}
          ownUnit={workingUnit}
          broad={organizationWide}
          canAuthor={canAuthorOrgObjectives}
          canManageCompany={canManageCompany}
          canReachSetup={canReachSetup}
          onFocus={(id) => replaceContext({ focusId: id })}
          onInspect={setPanelId}
          onCreate={(parentId, orgUnitId) => setComposer({ mode: "create", parentId, orgUnitId })}
          onResumeDraft={(id) => setComposer({ mode: "edit", objectiveId: id })}
          onDelete={handleDeleteOrg}
          onCreateCompany={() => setCompanyComposer({ mode: "create" })}
          onEditCompany={(id) => setCompanyComposer({ mode: "edit", objectiveId: id })}
          onPublishCompany={handlePublishCompany}
        />
      )}

      {/* Inspection + decision */}
      <ObjectiveContextPanel
        cycleId={cycle.id}
        objectiveId={panelId}
        open={panelId !== null}
        onOpenChange={(open) => {
          if (!open) setPanelId(null);
        }}
        onFocus={(id) => {
          replaceContext({ focusId: id });
          setPanelId(null);
        }}
        onEdit={(d) => {
          setPanelId(null);
          setComposer({ mode: "edit", objectiveId: d.node.id });
        }}
      />

      {composer ? (
        <OrgComposerHost
          cycle={cycle}
          state={composer}
          ownUnit={workingUnit}
          onClose={() => setComposer(null)}
          onFocusParent={setRevealId}
        />
      ) : null}

      {companyComposer ? (
        <CompanyComposerHost cycle={cycle} state={companyComposer} onClose={() => setCompanyComposer(null)} />
      ) : null}
    </PageContainer>
  );
}
