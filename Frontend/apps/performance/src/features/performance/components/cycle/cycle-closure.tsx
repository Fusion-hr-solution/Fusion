"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { CycleClosureDto, CycleDetailDto, RosterPlanStatus } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ds/components/ui/dialog";
import { Label } from "@repo/ds/components/ui/label";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { Textarea } from "@repo/ds/components/ui/textarea";
import { AsyncButton } from "@repo/ds/shell";
import { Lock } from "@/lib/icons";
import { useCloseCycle } from "../../api/use-performance";
import { performanceFailure, reportPerformanceFailure } from "../../api/performance-failure";
import { formatDate } from "../../lib";

const STANDING_LABEL: Record<RosterPlanStatus, string> = {
  NotStarted: "Not started",
  Draft: "Draft",
  ReturnedForChanges: "Returned",
  Submitted: "Awaiting decision",
  Approved: "Approved",
};

/**
 * Closing the Active Cycle. The dialog asks only for what closure genuinely needs: a reason when
 * the end date is still ahead, and a reason recorded against everyone without an approved plan.
 */
export function CloseCycleAction({ detail, closure }: { detail: CycleDetailDto; closure: CycleClosureDto | undefined }) {
  const [open, setOpen] = useState(false);
  const [earlyReason, setEarlyReason] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");
  const close = useCloseCycle(detail.cycle.id);
  const pending = close.isLoading;

  if (!closure) return null;
  const unresolved = closure.unresolved.length;
  const needsEarlyReason = !closure.endReached;
  const ready = (!needsEarlyReason || earlyReason.trim().length > 0) && (unresolved === 0 || exceptionReason.trim().length > 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) {
          setEarlyReason("");
          setExceptionReason("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Lock className="size-4" data-icon="inline-start" /> Close cycle
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close {detail.cycle.name}?</DialogTitle>
          <DialogDescription>
            Planning, progress and evidence stop. The Cycle stays readable as history.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-1">
          <dt className="type-label text-muted-foreground">Approved plans</dt>
          <dd className="type-body tabular-nums text-foreground">
            {closure.approvedCount} of {closure.participantCount}
          </dd>
          <dt className="type-label text-muted-foreground">Ends</dt>
          <dd className="type-body text-foreground">{formatDate(closure.endDate)}</dd>
        </dl>

        {needsEarlyReason ? (
          <div className="space-y-1.5">
            <Label htmlFor="early-close-reason">Why close before {formatDate(closure.endDate)}?</Label>
            <Textarea
              id="early-close-reason"
              value={earlyReason}
              onChange={(event) => setEarlyReason(event.target.value)}
              rows={2}
              maxLength={1000}
            />
          </div>
        ) : null}

        {unresolved > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor="closure-exception-reason">
              {unresolved === 1
                ? "Reason recorded for the 1 participant without an approved plan"
                : `Reason recorded for the ${unresolved} participants without an approved plan`}
            </Label>
            <Textarea
              id="closure-exception-reason"
              value={exceptionReason}
              onChange={(event) => setExceptionReason(event.target.value)}
              rows={2}
              maxLength={1000}
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <AsyncButton
            pending={pending}
            disabled={!ready}
            onClick={async () => {
              try {
                await close.mutateAsync({
                  request: {
                    earlyCloseReason: needsEarlyReason ? earlyReason.trim() : null,
                    exceptionReason: unresolved > 0 ? exceptionReason.trim() : null,
                  },
                  expectedVersion: detail.cycle.version,
                });
                toast.success(`${detail.cycle.name} is closed.`);
                setOpen(false);
              } catch (error) {
                if (performanceFailure(error).refresh) setOpen(false);
                reportPerformanceFailure(error, "Could not close the Cycle.");
              }
            }}
          >
            <Lock className="size-4" data-icon="inline-start" /> Close cycle
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Who stands between the Cycle and a clean close — or, once closed, who was closed as an exception. */
export function ClosureSection({ closure, loading }: { closure: CycleClosureDto | undefined; loading: boolean }) {
  if (loading) {
    return (
      <section className="space-y-3">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </section>
    );
  }
  if (!closure) return null;

  const closed = closure.state === "Closed";
  const rows = closed ? closure.unresolved.filter((row) => row.exceptionReason) : closure.unresolved;

  return (
    <section className="space-y-4">
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="type-section-title text-foreground">
          {closed ? (rows.length > 0 ? "Closed with exceptions" : "Closed with every plan approved") : "Without an approved plan"}
        </h2>
        <span className="type-body-secondary tabular-nums text-muted-foreground">
          {closure.approvedCount} of {closure.participantCount} approved
        </span>
      </header>

      {closed && closure.earlyCloseReason ? (
        <p className="type-body text-foreground">
          <span className="text-muted-foreground">Closed early · </span>
          {closure.earlyCloseReason}
        </p>
      ) : null}

      {rows.length === 0 ? (
        closed ? null : <p className="type-body-secondary text-muted-foreground">Every participant has an approved plan.</p>
      ) : (
        <ul className="divide-y divide-border rounded-surface border border-border bg-card">
          {rows.map((row) => (
            <li
              key={row.employeeId}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <p className="type-body truncate text-foreground">{row.displayName}</p>
                {row.orgUnitName ? (
                  <p className="type-body-secondary truncate text-muted-foreground">{row.orgUnitName}</p>
                ) : null}
              </div>
              <span className="type-body-secondary text-muted-foreground sm:max-w-[60%] sm:shrink-0 sm:text-end">
                {closed ? row.exceptionReason : STANDING_LABEL[row.standing]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
