"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { CycleDetailDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ds/components/ui/dialog";
import { AsyncButton } from "@repo/ds/shell";
import { formatDate } from "../lib";

/**
 * Activation is consequential, so it is confirmed — but it is a commitment, not a
 * destruction, so it states plainly what it opens and what it locks. No decorative
 * illustration; the facts carry the weight.
 */
export function ActivationReview({
  open,
  onOpenChange,
  detail,
  onActivate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: CycleDetailDto;
  onActivate: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  const locked: { label: string; value: ReactNode }[] = [
    {
      label: "Population",
      value: (
        <>
          <span className="font-semibold tabular-nums text-primary">
            {detail.confirmedParticipantCount}
          </span>{" "}
          people, frozen as the roster
        </>
      ),
    },
    {
      label: "Direction",
      value: (
        <>
          <span className="font-semibold tabular-nums text-primary">
            {detail.publishedStrategyCount}
          </span>{" "}
          published objective{detail.publishedStrategyCount === 1 ? "" : "s"}
        </>
      ),
    },
    { label: "Settings", value: "Locked to this Cycle" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Activate {detail.cycle.name}</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">
              Planning opens through {formatDate(detail.cycle.planningDeadline)}.
            </span>{" "}
            These lock into the Cycle and won&apos;t follow later changes.
          </DialogDescription>
        </DialogHeader>

        <dl className="divide-y divide-border border-y border-border">
          {locked.map((item) => (
            <div key={item.label} className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-sm font-medium text-foreground">{item.label}</dt>
              <dd className="text-right text-sm text-muted-foreground">{item.value}</dd>
            </div>
          ))}
        </dl>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <AsyncButton
            pending={submitting}
            pendingLabel="Activating…"
            onClick={async () => {
              setSubmitting(true);
              try {
                await onActivate();
                toast.success(`${detail.cycle.name} is now Active — planning is open.`);
                onOpenChange(false);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Activation failed.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            Activate Cycle
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
