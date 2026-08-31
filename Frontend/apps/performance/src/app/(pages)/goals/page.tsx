"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, ListChecks, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@repo/auth";
import type { GoalDetailDto, GoalNodeDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ds/components/ui/tabs";
import { PageContainer, PageError, PagePermissionNotice, PageSkeleton } from "@repo/ds/shell";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { CycleContextBar } from "@/features/performance/components/cycle-context-bar";
import { PerformancePageHeading } from "@/features/performance/components/performance-page-heading";
import { AlignmentMap } from "@/features/performance/components/goals/alignment-map";
import { GoalsList } from "@/features/performance/components/goals/goals-list";
import { ObjectiveContextPanel } from "@/features/performance/components/goals/objective-context-panel";
import { OrgObjectiveComposer } from "@/features/performance/components/goals/org-objective-composer";
import { usePerformanceAccess, useCurrentCycle, useGoals, useGoalMutations } from "@/features/performance/api/use-performance";

export default function GoalsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const myEmployeeId = user?.employeeId ?? null;
  const access = usePerformanceAccess();
  const canEnter = access.data?.canEnter ?? false;

  const detail = useCurrentCycle(canEnter);
  const cycle = detail.data?.cycle ?? null;
  const goals = useGoals(cycle?.id ?? null, canEnter);
  const mutations = useGoalMutations(cycle?.id ?? "");

  const [focusId, setFocusId] = useState<string | null>(null);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [composer, setComposer] = useState<{ parent: GoalNodeDto; editing?: GoalDetailDto } | null>(null);

  if (access.isLoading) return <PageSkeleton rows={4} label="Loading Performance" />;
  if (!canEnter) {
    return <PagePermissionNotice title="No Performance access" description="You do not have access to the Performance workspace." />;
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
  const canAuthorOrgObjectives =
    (access.data?.canAdminister ?? false) || (access.data?.canManageOrgObjectives ?? false);

  return (
    <PageContainer>
      <CycleContextBar cycle={cycle} />
      <PerformancePageHeading
        title="Goals"
        description="How company direction cascades into organizational objectives."
        actions={
          cycle.state === "Draft" && (access.data?.canAdminister ?? false) ? (
            <Button variant="outline" onClick={() => router.push("/setup")}>
              Cycle setup
            </Button>
          ) : undefined
        }
      />
      <div className="space-y-6">
        {goals.isLoading ? (
          <PageSkeleton rows={4} label="Loading goals" />
        ) : goals.error || !goals.data ? (
          <PageError title="Goals unavailable" description={goals.error?.message} onRetry={goals.refetch} />
        ) : (
          <Tabs defaultValue="alignment" className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabsList>
                <TabsTrigger value="alignment"><GitBranch className="size-4" data-icon="inline-start" /> Alignment</TabsTrigger>
                <TabsTrigger value="list"><ListChecks className="size-4" data-icon="inline-start" /> List</TabsTrigger>
              </TabsList>
              {goals.data.strategicCount > 0 && canAuthorOrgObjectives ? (
                <Button
                  size="sm"
                  onClick={() => {
                    // Default parent: the focused node if it can host children, else the first strategic root.
                    const graphNodes = goals.data!.nodes;
                    const focus = focusId ? graphNodes.find((n) => n.id === focusId) : undefined;
                    const root = graphNodes.find((n) => n.ownershipScope === "Company" && n.isAlignmentBaseline);
                    const parent = (focus && focus.isAlignmentBaseline ? focus : root) ?? null;
                    if (!parent) {
                      toast.error("Publish strategic direction before adding organizational objectives.");
                      return;
                    }
                    setComposer({ parent });
                  }}
                >
                  <Plus className="size-4" data-icon="inline-start" /> New objective
                </Button>
              ) : null}
            </div>

            <TabsContent value="alignment" className="mt-0">
              <AlignmentMap
                overview={goals.data}
                focusId={focusId}
                onFocus={setFocusId}
                onInspect={setPanelId}
                onCreateUnder={(parent) => setComposer({ parent })}
                canAuthor={canAuthorOrgObjectives}
              />
            </TabsContent>

            <TabsContent value="list" className="mt-0">
              <GoalsList overview={goals.data} onInspect={setPanelId} />
            </TabsContent>
          </Tabs>
        )}
      </div>

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
          if (d.parent) setComposer({ parent: d.parent, editing: d });
        }}
      />

      {/* Create / edit */}
      {composer ? (
        <OrgObjectiveComposer
          open={composer !== null}
          onOpenChange={(open) => {
            if (!open) setComposer(null);
          }}
          parent={composer.parent}
          objective={composer.editing}
          defaultAccountable={myEmployeeId ? { id: myEmployeeId, name: user?.fullName ?? "You" } : null}
          onCreate={async (request) => {
            const result = await mutations.create.mutateAsync(request);
            toast.success("Objective created.");
            setFocusId(composer.parent.id);
            setPanelId(result.node.id);
          }}
          onUpdate={async (request) => {
            if (!composer.editing) return;
            await mutations.update.mutateAsync({ objectiveId: composer.editing.node.id, request });
            toast.success("Objective updated.");
          }}
        />
      ) : null}
    </PageContainer>
  );
}
