"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Plus, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@repo/ds/components/ui/button";
import { PageContainer, PageError, PagePermissionNotice, PageSkeleton } from "@repo/ds/shell";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { CycleContextBar } from "@/features/performance/components/cycle-context-bar";
import { PerformancePageHeading } from "@/features/performance/components/performance-page-heading";
import { ObjectiveCascade } from "@/features/performance/components/goals/objective-cascade";
import {
  EMPTY_FILTER,
  FilteredObjectives,
  GoalsFilter,
  isFilterActive,
  type GoalsFilterState,
} from "@/features/performance/components/goals/goals-filter";
import { ObjectiveContextPanel } from "@/features/performance/components/goals/objective-context-panel";
import { ContributionExplorer } from "@/features/performance/components/contribution/contribution-explorer";
import { usePerformanceAccess, useCurrentCycle, useGoals } from "@/features/performance/api/use-performance";

type View = "cascade" | "contribution";

export default function GoalsPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={4} label="Loading goals" />}>
      <GoalsWorkspace />
    </Suspense>
  );
}

function GoalsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const access = usePerformanceAccess();
  const a = access.data;
  const scope = a?.aggregateViewScope ?? null;
  const hasOrgRead = scope === "DirectReports" || scope === "OrgUnit" || scope === "Tenant";
  // Organization Goals is an organization-direction surface, not a universal employee
  // destination: it opens for organizational/strategic/admin responsibility or organizational
  // read authority. Ordinary Self-only participants reach direction through Overview, not here.
  const canViewOrgGoals =
    (a?.canAdminister ?? false) ||
    (a?.canPublishStrategy ?? false) ||
    (a?.canManageOrgObjectives ?? false) ||
    hasOrgRead;
  // Contribution keeps its own, current audience (leadership org-read + strategy/admin), narrower
  // than Goals itself — an org-objective author without a view grant sees Goals but not this lens.
  const canExplore = (a?.canAdminister ?? false) || (a?.canPublishStrategy ?? false) || hasOrgRead;

  const detail = useCurrentCycle(canViewOrgGoals);
  const cycle = detail.data?.cycle ?? null;
  const goals = useGoals(cycle?.id ?? null, canViewOrgGoals);

  const [view, setView] = useState<View>("cascade");
  const [filter, setFilter] = useState<GoalsFilterState>(EMPTY_FILTER);
  // Returning from the composer reveals the parent whose cascade the new/edited objective lives in.
  const [focusId, setFocusId] = useState<string | null>(() => searchParams.get("focus"));
  const [panelId, setPanelId] = useState<string | null>(null);

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
  // (governed admin, or the org-manage grant). The precise per-org-unit check — the objective's
  // owning unit must be the caller's own unit or a descendant — is enforced server-side when the
  // unit is chosen, so this only decides whether to offer the affordance at all.
  const canAuthorOrgObjectives = (a?.canAdminister ?? false) || (a?.canManageOrgObjectives ?? false);

  const openComposer = (parentId: string) => router.push(`/goals/new?parent=${parentId}`);

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
  const showFiltered = overview != null && isFilterActive(filter);

  return (
    <PageContainer>
      <CycleContextBar cycle={cycle} />
      <PerformancePageHeading
        title="Organization Goals"
        description="Planning & Direction"
        actions={
          overview ? (
            <>
              {canExplore ? (
                <Button variant="ghost" size="sm" onClick={() => setView("contribution")}>
                  <TrendingUp className="size-4" data-icon="inline-start" /> Contribution
                </Button>
              ) : null}
              <GoalsFilter overview={overview} value={filter} onChange={setFilter} />
              {overview.strategicCount > 0 && canAuthorOrgObjectives ? (
                <Button
                  size="sm"
                  onClick={() => {
                    // Default parent: the focused node if it is a published baseline, else the
                    // first published strategic root. Creation cannot align beneath a Draft.
                    const nodes = overview.nodes;
                    const focus = focusId ? nodes.find((n) => n.id === focusId) : undefined;
                    const root = nodes.find((n) => n.ownershipScope === "Company" && n.isAlignmentBaseline);
                    const parent = (focus && focus.isAlignmentBaseline ? focus : root) ?? null;
                    if (!parent) {
                      toast.error("Publish strategic direction before adding organizational objectives.");
                      return;
                    }
                    openComposer(parent.id);
                  }}
                >
                  <Plus className="size-4" data-icon="inline-start" /> Create objective
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      />

      {goals.isLoading ? (
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
        <ObjectiveCascade
          overview={overview}
          focusId={focusId}
          onFocus={setFocusId}
          onInspect={setPanelId}
          onCreateUnder={(parent) => openComposer(parent.id)}
          canAuthor={canAuthorOrgObjectives}
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
          router.push(`/goals/${d.node.id}/edit`);
        }}
      />
    </PageContainer>
  );
}
