"use client";

import { useState } from "react";
import { Button } from "@repo/ds/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@repo/ds/components/ui/sheet";
import { AsyncButton, PageError, PageSkeleton } from "@repo/ds/shell";
import { useObjectiveProgress, useProgressMutations } from "../../api/use-performance";
import { ProgressUpdateComposer } from "../progress/progress-update-composer";

/**
 * Record progress on the canonical organizational objective the manager's scope owns. It is not a
 * Team-Performance-specific progress path: it drives the same `useObjectiveProgress` / `submitProgress`
 * machinery and the same measurement-aware `ProgressUpdateComposer` the employee-plan recorder uses, so
 * an update recorded here is the one canonical progress truth read back everywhere (Team Direction,
 * Organization Goals, Contribution).
 */
export function TeamObjectiveRecordDrawer({
  cycleId,
  objectiveId,
  title,
  open,
  onOpenChange,
}: {
  cycleId: string;
  objectiveId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const progressQuery = useObjectiveProgress(cycleId, open ? objectiveId : null);
  const mutations = useProgressMutations(cycleId, objectiveId);
  const progress = progressQuery.data;
  const [canSubmit, setCanSubmit] = useState(false);
  const formId = "team-objective-record-form";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-[540px]">
        <div className="border-b border-border px-5 pb-4 pt-5 pr-12">
          <SheetTitle className="text-[0.95rem] leading-snug tracking-tight">{title}</SheetTitle>
          <p className="mt-1 text-xs font-medium text-primary">Record progress</p>
        </div>
        <SheetDescription className="sr-only">Record progress for the objective {title}.</SheetDescription>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {progressQuery.isLoading ? (
            <PageSkeleton rows={2} label="Loading progress" />
          ) : progressQuery.error || !progress ? (
            <PageError
              title="Progress unavailable"
              description={progressQuery.error?.message}
              onRetry={progressQuery.refetch}
            />
          ) : (
            <ProgressUpdateComposer
              progress={progress}
              submitting={mutations.submit.isLoading}
              formId={formId}
              onSubmit={(request) => mutations.submit.mutateAsync(request).then(() => undefined)}
              upload={(file) => mutations.uploadEvidence.mutateAsync(file)}
              onValidityChange={setCanSubmit}
              onRecorded={() => onOpenChange(false)}
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-background px-5 py-3.5">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <AsyncButton
            type="submit"
            form={formId}
            pending={mutations.submit.isLoading}
            disabled={!canSubmit || !progress}
          >
            Record progress
          </AsyncButton>
        </div>
      </SheetContent>
    </Sheet>
  );
}
