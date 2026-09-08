"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@repo/auth";
import type { CycleSummaryDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@repo/ds/components/ui/dialog";
import { PageContainer, PageError, PagePermissionNotice, PageSkeleton } from "@repo/ds/shell";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { CycleContextBar } from "@/features/performance/components/cycle-context-bar";
import { PerformancePageHeading } from "@/features/performance/components/performance-page-heading";
import {
  EMPTY_FILTER,
  FilteredObjectives,
  GoalsFilter,
  isFilterActive,
  type GoalsFilterState,
} from "@/features/performance/components/goals/goals-filter";
import { ObjectiveContextPanel } from "@/features/performance/components/goals/objective-context-panel";
import { ObjectiveWorkspace } from "@/features/performance/components/goals/objective-workspace";
import { OrgObjectiveComposer } from "@/features/performance/components/goals/org-objective-composer";
import { type UnitContext } from "@/features/performance/components/goals/working-context-lib";
import { ContributionExplorer } from "@/features/performance/components/contribution/contribution-explorer";
import {
  usePerformanceAccess,
  useCurrentCycle,
  useGoal,
  useGoals,
  useGoalMutations,
} from "@/features/performance/api/use-performance";
import { useWorkforceMe } from "@/features/performance/api/use-workforce-me";

type View = "cascade" | "contribution";

/** What the composer is opened for — create beneath a parent, or edit an existing draft. */
type ComposerState =
  | { mode: "create"; parentId: string; orgUnitId: string | null }
  | { mode: "edit"; objectiveId: string };

export default function GoalsPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={4} label="Loading goals" />}>
      <GoalsWorkspace />
    </Suspense>
  );
}

function GoalsWorkspace() {
  const searchParams = useSearchParams();
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
  const canExplore = (a?.canAdminister ?? false) || (a?.canPublishStrategy ?? false) || hasOrgRead;
  // Authority (not placement) decides the default context. A tenant-wide actor (administration, or
  // tenant-breadth read) is responsible for the whole organization, so they land organization-wide;
  // everyone else is centered on the unit they actually belong to. Both drill the same hierarchy.
  const broad = (a?.canAdminister ?? false) || scope === "Tenant";
  const canReachSetup = (a?.canAdminister ?? false) || (a?.canPublishStrategy ?? false);

  const detail = useCurrentCycle(canViewOrgGoals);
  const cycle = detail.data?.cycle ?? null;
  const goals = useGoals(cycle?.id ?? null, canViewOrgGoals);
  // The actor's own organizational context — resolved from real workforce data, never fabricated.
  // Only workforce (non-broad) actors need it for their default unit context.
  const me = useWorkforceMe(canViewOrgGoals && !broad);

  const [view, setView] = useState<View>("cascade");
  const [filter, setFilter] = useState<GoalsFilterState>(EMPTY_FILTER);
  // Drill focus. Seeded from `focus` so returning from the composer reveals the parent branch.
  const [focusId, setFocusId] = useState<string | null>(() => searchParams.get("focus"));
  const [panelId, setPanelId] = useState<string | null>(null);
  const [composer, setComposer] = useState<ComposerState | null>(null);

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

  // The contribution lens is a preserved, quiet secondary entry — a full-page swap, not a co-equal
  // landing tab. Cycle context stays; the lens brings its own heading and internal drill path.
  if (view === "contribution") {
    return (
      <PageContainer>
        <CycleContextBar cycle={cycle} />
        <button
          type="button"
          onClick={() => setView("cascade")}
          className="mb-4 inline-flex items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft className="size-4" aria-hidden /> Planning &amp; Direction
        </button>
        <ContributionExplorer cycleId={cycle.id} />
      </PageContainer>
    );
  }

  const overview = goals.data;
  const meResolving = !broad && me.isLoading;
  // Filter/search is a broad-context utility; it folds in the retired List view when engaged.
  const showFiltered = broad && overview != null && isFilterActive(filter);

  // Organization-wide and every established context is a read/explore surface. Authoring an
  // organizational objective is offered only from that scope's own empty working context — where the
  // parent objective and organizational scope are both already unambiguous — never as a generic
  // "create anywhere" action here (parent + owning unit would be ambiguous).
  const actions = overview ? (
    <>
      {canExplore ? (
        <Button variant="ghost" size="sm" onClick={() => setView("contribution")}>
          <TrendingUp className="size-4" data-icon="inline-start" /> Contribution
        </Button>
      ) : null}
      {broad ? <GoalsFilter overview={overview} value={filter} onChange={setFilter} /> : null}
    </>
  ) : undefined;

  return (
    <PageContainer>
      <CycleContextBar cycle={cycle} />
      <PerformancePageHeading title="Organization Goals" description="Planning & Direction" actions={actions} />

      {goals.isLoading || meResolving ? (
        <PageSkeleton rows={4} label="Loading goals" />
      ) : goals.error || !overview ? (
        <PageError title="Goals unavailable" description={goals.error?.message} onRetry={goals.refetch} />
      ) : showFiltered ? (
        <FilteredObjectives
          overview={overview}
          filter={filter}
          onInspect={setPanelId}
          onClear={() => setFilter(EMPTY_FILTER)}
        />
      ) : (
        <ObjectiveWorkspace
          cycleId={cycle.id}
          overview={overview}
          focusId={focusId}
          ownUnit={ownUnit}
          broad={broad}
          canAuthor={canAuthorOrgObjectives}
          canReachSetup={canReachSetup}
          onFocus={setFocusId}
          onInspect={setPanelId}
          onCreate={(parentId, orgUnitId) => setComposer({ mode: "create", parentId, orgUnitId })}
          onResumeDraft={(id) => setComposer({ mode: "edit", objectiveId: id })}
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
          setFocusId(id);
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
          ownUnit={ownUnit}
          onClose={() => setComposer(null)}
          onFocusParent={setFocusId}
        />
      ) : null}
    </PageContainer>
  );
}

/**
 * Resolves the modal's inputs on open — the parent (for create) or the full draft and its parent (for
 * edit) — and owns the goal mutations the surface-agnostic composer reports through. This is what the
 * two deleted route pages used to do; here it overlays the workspace instead of navigating away.
 */
function OrgComposerHost({
  cycle,
  state,
  ownUnit,
  onClose,
  onFocusParent,
}: {
  cycle: CycleSummaryDto;
  state: ComposerState;
  ownUnit: UnitContext | null;
  onClose: () => void;
  onFocusParent: (parentId: string) => void;
}) {
  const { user } = useAuth();
  const mutations = useGoalMutations(cycle.id);
  const isCreate = state.mode === "create";

  const parentQuery = useGoal(cycle.id, isCreate ? state.parentId : null);
  const objectiveQuery = useGoal(cycle.id, isCreate ? null : state.objectiveId);

  const objective = isCreate ? undefined : objectiveQuery.data;
  const parentNode = isCreate ? (parentQuery.data?.node ?? null) : (objective?.parent ?? null);

  // A create can only align beneath a Published baseline; an edit only opens an editable org-unit draft.
  // The triggers already respect this, so a failure here is defensive — close with a brief notice
  // rather than render a form that would fail on submit.
  const query = isCreate ? parentQuery : objectiveQuery;
  const invalid = isCreate
    ? !parentQuery.isLoading &&
      (Boolean(parentQuery.error) || !parentNode || !parentNode.isAlignmentBaseline)
    : !objectiveQuery.isLoading &&
      (Boolean(objectiveQuery.error) ||
        !objective ||
        objective.node.ownershipScope !== "OrgUnit" ||
        !objective.parent ||
        !objective.canEdit);

  useEffect(() => {
    if (invalid) {
      toast.error(
        isCreate
          ? "That direction can’t take a new objective yet."
          : "This objective can’t be edited."
      );
      onClose();
    }
  }, [invalid, isCreate, onClose]);

  if (invalid) return null;

  const defaultAccountable = user?.employeeId
    ? { id: user.employeeId, name: user.fullName ?? "You" }
    : null;
  // Only the actor's own unit can be named without a roster grant; any other scope stays unset.
  const defaultOrgUnit =
    isCreate && state.orgUnitId && ownUnit && ownUnit.orgUnitId === state.orgUnitId
      ? { id: ownUnit.orgUnitId, name: ownUnit.name, path: [] }
      : null;

  if (query.isLoading || !parentNode || (!isCreate && !objective)) {
    return (
      <Dialog open onOpenChange={(o) => (!o ? onClose() : undefined)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogTitle>Opening objective…</DialogTitle>
          <div className="mt-4 space-y-3" aria-hidden>
            <div className="h-9 animate-pulse rounded-lg bg-muted" />
            <div className="h-24 animate-pulse rounded-lg bg-muted" />
            <div className="h-24 animate-pulse rounded-lg bg-muted" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <OrgObjectiveComposer
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      cycle={cycle}
      parent={parentNode}
      objective={objective}
      defaultAccountable={defaultAccountable}
      defaultOrgUnit={defaultOrgUnit}
      onCreate={async (request) => {
        const created = await mutations.create.mutateAsync(request);
        onFocusParent(parentNode.id);
        return created;
      }}
      onUpdate={async (objectiveId, request) => {
        await mutations.update.mutateAsync({ objectiveId, request });
        onFocusParent(parentNode.id);
      }}
      onPublish={async (objectiveId) => {
        await mutations.publish.mutateAsync(objectiveId);
        onFocusParent(parentNode.id);
      }}
    />
  );
}
