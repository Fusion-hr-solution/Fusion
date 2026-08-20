"use client";

import { Button } from "@repo/ds";
import { Spinner } from "@repo/ds";
import { AlertTriangle, RotateCcw } from "lucide-react";
import type { WorkforceApplyStatusDto } from "@repo/api";

const PHASE_LABEL: Record<string, string> = {
  Preparing: "Preparing workforce",
  Validating: "Validating relationships",
  Saving: "Saving workforce",
  Saved: "Saving workforce",
};

/**
 * Applying state — real, honest progress. Only real phases/counters; never "N added"
 * before the atomic commit. Refresh restores this state (the operation is server-side).
 */
export function WorkforceApplyState({
  status,
  onReturnToReview,
  onRetry,
}: {
  status: WorkforceApplyStatusDto;
  onReturnToReview: () => void;
  onRetry: () => void;
}) {
  if (status.status === "Failed") {
    return (
      <Centered>
        <AlertTriangle className="size-6 text-[var(--color-warning)]" aria-hidden />
        <h2 className="mt-3 type-title font-semibold text-foreground">Import wasn&apos;t completed</h2>
        <p className="mt-1 type-body text-muted-foreground">No employees were added from this attempt.</p>
        <div className="mt-5 flex items-center gap-3">
          <Button onClick={onRetry}>
            <RotateCcw className="size-4" aria-hidden /> Retry
          </Button>
          <Button variant="ghost" onClick={onReturnToReview} className="text-muted-foreground">
            Return to review
          </Button>
        </div>
      </Centered>
    );
  }

  const phase = PHASE_LABEL[status.phase] ?? "Completing import";
  return (
    <Centered>
      <Spinner className="size-6 text-primary" />
      <h2 className="mt-4 type-title font-semibold text-foreground">Completing import</h2>
      <p className="mt-1 type-body text-muted-foreground">{phase}</p>
      {status.total ? (
        <p className="mt-2 type-meta text-muted-foreground tabular-nums">
          {status.processed} of {status.total} processed
        </p>
      ) : null}
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  // Fills the shell's flex body so the state is centered on both axes of the page,
  // not within a narrow left-aligned content column.
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-8">
      <div className="flex max-w-sm flex-col items-center text-center">{children}</div>
    </div>
  );
}
