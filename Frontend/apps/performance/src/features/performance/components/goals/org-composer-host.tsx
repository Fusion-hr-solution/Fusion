"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@repo/auth";
import type { CycleSummaryDto } from "@repo/api";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@repo/ds/components/ui/dialog";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import {
  useGoal,
  useGoalMutations,
  usePerformanceAccess,
} from "../../api/use-performance";
import { OrgObjectiveComposer } from "./org-objective-composer";
import { type UnitContext } from "./working-context-lib";

export type ComposerAlignmentContext =
  | { mode: "aligned"; parentId: string }
  | { mode: "standalone" }
  | null;

/** What the composer is opened for: a new team objective or an existing Draft. */
export type ComposerState =
  | {
      mode: "create";
      alignment: ComposerAlignmentContext;
      orgUnitId: string | null;
    }
  | { mode: "edit"; objectiveId: string; focusAlignment?: boolean };

/**
 * Resolves the modal's inputs on open — the parent (for create) or the full draft and its parent (for
 * edit) — and owns the goal mutations the surface-agnostic composer reports through. The composer knows
 * nothing about who opened it; this host binds it to the canonical organizational-objective mutations so
 * any surface (Organization Goals, Team Performance) creates and edits the *same* objective resource.
 *
 * `onFocusParent` lets a surface that has a drill/reveal concept (Organization Goals) light up the parent
 * branch after a mutation; surfaces without one (Team Performance) pass a no-op and simply let query
 * invalidation refresh their view.
 */
export function OrgComposerHost({
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
  onFocusParent?: (parentId: string) => void;
}) {
  const { user } = useAuth();
  const access = usePerformanceAccess();
  const mutations = useGoalMutations(cycle.id);
  const isCreate = state.mode === "create";

  const objectiveQuery = useGoal(cycle.id, isCreate ? null : state.objectiveId);

  const objective = isCreate ? undefined : objectiveQuery.data;

  // Create eligibility is resolved from the selected team's workspace inside the composer. Editing
  // still requires an editable organizational Draft, but a parent is no longer mandatory.
  const invalid =
    !isCreate &&
    !objectiveQuery.isLoading &&
    (Boolean(objectiveQuery.error) ||
      !objective ||
      objective.node.ownershipScope !== "OrgUnit" ||
      !objective.canEdit);

  useEffect(() => {
    if (invalid) {
      toast.error("This objective can’t be edited.");
      onClose();
    }
  }, [invalid, isCreate, onClose]);

  if (invalid) return null;

  const defaultAccountable = user?.employeeId
    ? { id: user.employeeId, name: user.fullName ?? "You" }
    : null;
  // Only the actor's own unit can be named without a roster grant; any other scope stays unset.
  const canChooseTeam = access.data?.canAdminister ?? false;
  const requestedOrgUnitId = isCreate
    ? state.orgUnitId
    : objective?.node.orgUnitId;
  const defaultOrgUnit =
    requestedOrgUnitId && ownUnit?.orgUnitId === requestedOrgUnitId
      ? { id: ownUnit.orgUnitId, name: ownUnit.name, path: [] }
      : !canChooseTeam && ownUnit
        ? { id: ownUnit.orgUnitId, name: ownUnit.name, path: [] }
        : objective?.node.orgUnitId
          ? {
              id: objective.node.orgUnitId,
              name: objective.node.orgUnitName ?? "Selected team",
              path: [],
            }
          : null;

  if (
    access.isLoading ||
    (!isCreate && (objectiveQuery.isLoading || !objective))
  ) {
    return <ComposerSkeleton isCreate={isCreate} onClose={onClose} />;
  }

  return (
    <OrgObjectiveComposer
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      cycle={cycle}
      initialAlignment={
        isCreate
          ? state.alignment
          : objective!.node.parentObjectiveId
            ? { mode: "aligned", parentId: objective!.node.parentObjectiveId }
            : { mode: "standalone" }
      }
      objective={objective}
      defaultAccountable={defaultAccountable}
      defaultOrgUnit={defaultOrgUnit}
      teamLocked={!canChooseTeam || !isCreate}
      focusAlignment={!isCreate && state.focusAlignment === true}
      onCreate={async (request) => {
        const created = await mutations.create.mutateAsync(request);
        if (request.parentObjectiveId)
          onFocusParent?.(request.parentObjectiveId);
        return created;
      }}
      onUpdate={async (objectiveId, request) => {
        await mutations.update.mutateAsync({ objectiveId, request });
        if (request.parentObjectiveId)
          onFocusParent?.(request.parentObjectiveId);
      }}
      onPublish={async (objectiveId) => {
        await mutations.publish.mutateAsync(objectiveId);
        const parentId = isCreate
          ? state.alignment?.mode === "aligned"
            ? state.alignment.parentId
            : null
          : objective?.node.parentObjectiveId;
        if (parentId) onFocusParent?.(parentId);
      }}
    />
  );
}

/** Section heading placeholder: step number disc and title, matching ObjectiveComposerSection. */
function SectionHead({ width }: { width: string }) {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="size-6 rounded-full" />
      <Skeleton className={`h-5 ${width}`} />
    </div>
  );
}

function FieldSkeleton({
  control = "h-9",
  label = "w-24",
}: {
  control?: string;
  label?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Skeleton className={`h-4 ${label}`} />
      <Skeleton className={`w-full rounded-xl ${control}`} />
    </div>
  );
}

/**
 * The composer's loading state in its real frame — fixed header and footer, parent band, then the three
 * numbered sections — so the form fills in place rather than swapping in over a different layout.
 */
function ComposerSkeleton({
  isCreate,
  onClose,
}: {
  isCreate: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="flex max-h-[92vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <div className="border-b border-border px-6 py-5 pr-14">
          <DialogTitle>
            {isCreate ? "Create organizational objective" : "Edit objective"}
          </DialogTitle>
        </div>
        <div
          className="flex-1 overflow-y-auto px-6 py-6"
          role="status"
          aria-label="Loading objective"
        >
          <div className="space-y-8">
            <div className="space-y-2 rounded-2xl border border-border bg-muted/30 p-4">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3.5 w-40" />
            </div>
            <div className="space-y-4">
              <SectionHead width="w-44" />
              <FieldSkeleton label="w-12" />
              <FieldSkeleton label="w-32" control="h-16" />
            </div>
            <div className="space-y-4">
              <SectionHead width="w-52" />
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldSkeleton label="w-40" />
                <FieldSkeleton label="w-36" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FieldSkeleton label="w-10" />
                <FieldSkeleton label="w-10" />
              </div>
            </div>
            <div className="space-y-4">
              <SectionHead width="w-32" />
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex gap-3 rounded-xl border border-border p-4"
                  >
                    <Skeleton className="size-9 shrink-0 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3.5 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-6 py-4">
          <Skeleton className="h-9 w-20" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
