"use client";

import { toast } from "sonner";
import type { CycleSummaryDto } from "@repo/api";
import { Dialog, DialogContent, DialogTitle } from "@repo/ds/components/ui/dialog";
import { useSaveStrategy, useStrategy } from "../../api/use-performance";
import {
  ObjectiveEditor,
  type ObjectiveDraft,
  type ObjectiveSubmissionIntent,
} from "../objective-editor";

/** What the company composer is opened for — a new root direction, or editing an existing draft. */
export type CompanyComposerState = { mode: "create" } | { mode: "edit"; objectiveId: string };

/**
 * Company (strategic) objective authoring, hosted on the Organization Goals workspace. A company
 * objective is a root of the cascade (parent = none, ownership = Company), so it is created and
 * maintained through the strategic-direction transport rather than the organizational-objective one —
 * this host binds the shared {@link ObjectiveEditor} to `useSaveStrategy` so the same editor Cycle
 * setup uses also establishes direction here (§9, §18). Completed company direction publishes in the
 * same request as its details; saving as Draft remains an explicit secondary choice.
 */
export function CompanyComposerHost({
  cycle,
  state,
  onClose,
}: {
  cycle: CycleSummaryDto;
  state: CompanyComposerState;
  onClose: () => void;
}) {
  const isEdit = state.mode === "edit";
  const mutations = useSaveStrategy(cycle.id);
  // Only fetch the strategy list when editing — we need the full objective (measurement, dates) to
  // seed the editor, which the flat goals node does not carry.
  const strategy = useStrategy(isEdit ? cycle.id : null);
  const objective = isEdit ? strategy.data?.find((o) => o.id === state.objectiveId) : undefined;

  // Editing waits for the objective to resolve so the editor seeds from real values rather than
  // flashing empty; a vanished draft closes with a brief notice.
  if (isEdit && strategy.isLoading) {
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
  if (isEdit && !objective) {
    toast.error("This objective can’t be edited.");
    onClose();
    return null;
  }

  return (
    <ObjectiveEditor
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      cycle={cycle}
      objective={objective}
      publishByDefault
      onSubmit={async (draft: ObjectiveDraft, intent: ObjectiveSubmissionIntent) => {
        const publish = intent === "publish";
        if (isEdit) {
          await mutations.update.mutateAsync({
            objectiveId: state.objectiveId,
            request: {
              title: draft.title,
              description: draft.description || null,
              accountablePersonId: draft.accountablePersonId,
              startDate: draft.startDate,
              endDate: draft.endDate,
              measurement: draft.measurement,
              publish,
            },
          });
          toast.success(publish ? "Company direction published." : "Objective updated.");
        } else {
          await mutations.create.mutateAsync({
            title: draft.title,
            description: draft.description || null,
            accountablePersonId: draft.accountablePersonId,
            startDate: draft.startDate,
            endDate: draft.endDate,
            measurement: draft.measurement,
            publish,
          });
          toast.success(publish ? "Company direction published." : "Company objective saved as draft.");
        }
      }}
    />
  );
}
