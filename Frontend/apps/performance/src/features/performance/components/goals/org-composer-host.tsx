"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@repo/auth";
import type { CycleSummaryDto } from "@repo/api";
import { Dialog, DialogContent, DialogTitle } from "@repo/ds/components/ui/dialog";
import { useGoal, useGoalMutations } from "../../api/use-performance";
import { OrgObjectiveComposer } from "./org-objective-composer";
import { type UnitContext } from "./working-context-lib";

/** What the composer is opened for — create beneath a parent, or edit an existing draft. */
export type ComposerState =
  | { mode: "create"; parentId: string; orgUnitId: string | null }
  | { mode: "edit"; objectiveId: string };

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
        onFocusParent?.(parentNode.id);
        return created;
      }}
      onUpdate={async (objectiveId, request) => {
        await mutations.update.mutateAsync({ objectiveId, request });
        onFocusParent?.(parentNode.id);
      }}
      onPublish={async (objectiveId) => {
        await mutations.publish.mutateAsync(objectiveId);
        onFocusParent?.(parentNode.id);
      }}
    />
  );
}
