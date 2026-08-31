"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@repo/ds/components/ui/sheet";
import { PageError, PageSkeleton } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { useObjectiveProgress, useProgressMutations } from "../../api/use-performance";
import { ProgressUpdateComposer } from "./progress-update-composer";
import { ProgressHistory } from "./progress-history";
import { pct } from "./progress-lib";

/**
 * The objective progress surface as a right-side panel: current derived progress, the measurement-aware
 * update composer for the owner, and the attributable history — inspected without leaving the plan.
 */
export function ObjectiveProgressPanel({
  cycleId,
  objectiveId,
  open,
  onOpenChange,
}: {
  cycleId: string;
  objectiveId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const query = useObjectiveProgress(open ? cycleId : null, open ? objectiveId : null);
  const mutations = useProgressMutations(cycleId, objectiveId ?? "none");
  const progress = query.data;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b p-6">
          <SheetTitle>{progress?.title ?? "Progress"}</SheetTitle>
          <SheetDescription className="sr-only">Record and review progress for this objective.</SheetDescription>
          {progress ? (
            <div className="mt-2 flex items-baseline gap-2">
              <span className={cn("type-metric", progress.derivedProgress >= 100 ? "text-success" : "text-foreground")}>
                {progress.hasProgress ? `${pct(progress.derivedProgress)}%` : "—"}
              </span>
              <span className="text-sm text-muted-foreground">{progress.hasProgress ? "current progress" : "no progress recorded"}</span>
            </div>
          ) : null}
        </SheetHeader>

        {query.isLoading ? (
          <div className="p-6"><PageSkeleton rows={3} label="Loading progress" /></div>
        ) : query.error || !progress ? (
          <div className="p-6"><PageError title="Progress unavailable" description={query.error?.message} onRetry={query.refetch} /></div>
        ) : (
          <div className="flex-1 space-y-6 p-6">
            {progress.canUpdate ? (
              <ProgressUpdateComposer
                progress={progress}
                submitting={mutations.submit.isLoading}
                onSubmit={(request) => mutations.submit.mutateAsync(request).then(() => undefined)}
                upload={(file) => mutations.uploadEvidence.mutateAsync(file)}
              />
            ) : null}

            <div>
              <p className="mb-3 type-eyebrow text-muted-foreground">History</p>
              <ProgressHistory history={progress.history} downloadHref={(path) => `/api${path}`} />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
