"use client";

import { useState } from "react";
import { CheckCircle2, Rocket, Users } from "lucide-react";
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

/**
 * Activation is consequential, so it is confirmed — but it is a commitment, not a destruction, so
 * it states what it preserves rather than warning. Distinct from an ordinary Save.
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

  const preserved = [
    { icon: Users, label: "Confirmed population", value: `${detail.confirmedParticipantCount} participants, frozen as the roster` },
    { icon: CheckCircle2, label: "Strategic direction", value: `${detail.publishedStrategyCount} published objective${detail.publishedStrategyCount === 1 ? "" : "s"}` },
    { icon: CheckCircle2, label: "Effective settings", value: "Captured into the activation snapshot" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Rocket className="size-4" aria-hidden />
            </span>
            Activate {detail.cycle.name}
          </DialogTitle>
          <DialogDescription>
            Activation opens planning for everyone in the roster and preserves the current setup.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 py-1">
          {preserved.map((item) => (
            <li key={item.label} className="flex items-start gap-3">
              <item.icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span className="text-sm">
                <span className="font-medium">{item.label}.</span>{" "}
                <span className="text-muted-foreground">{item.value}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          After activation the roster no longer changes with workforce edits, and later Settings
          changes will not alter this Cycle.
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Not yet
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
