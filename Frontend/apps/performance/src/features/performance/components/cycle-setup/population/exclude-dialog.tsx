"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ds/components/ui/dialog";
import { Button } from "@repo/ds/components/ui/button";
import { Label } from "@repo/ds/components/ui/label";
import { Textarea } from "@repo/ds/components/ui/textarea";
import { AsyncButton } from "@repo/ds/shell";
import type { PopulationCandidateDto } from "@repo/api";
import { readinessIssueDetail } from "@/features/performance/lib";
import { primaryIssue } from "./population-model";

const REASON_MAX = 240;

/** The candidate's blocking readiness issue, phrased as an exclusion reason; empty when healthy. */
export function issueReason(candidate: PopulationCandidateDto, eligibilityDate: string): string {
  const issue = primaryIssue(candidate);
  if (!issue) return "";
  const detail = readinessIssueDetail(issue.code, eligibilityDate);
  return detail ? `${issue.label}: ${detail}` : issue.label;
}

/**
 * Excluding a person from the cycle is a decision that must be justified — the reason is captured
 * with the exclusion and stays on record. Removing someone eligible without a reason is exactly
 * what this guards against.
 */
export function ExcludeDialog({
  name,
  defaultReason,
  confirmLabel,
  open,
  onOpenChange,
  onExclude,
}: {
  name: string | null;
  /** Prefills the reason, e.g. with the readiness issue that blocks the person. */
  defaultReason?: string;
  /** The confirm button's label; defaults to a singular exclude. Bulk passes "Exclude N employees". */
  confirmLabel?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExclude: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setReason((defaultReason ?? "").slice(0, REASON_MAX));
      setPending(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- seed once per opening

  const trimmed = reason.trim();

  async function submit() {
    if (!trimmed) return;
    setPending(true);
    try {
      await onExclude(trimmed);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not exclude this employee.");
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exclude {name ?? "this employee"}?</DialogTitle>
          <DialogDescription>
            They will not participate in this cycle. The reason is kept with the exclusion.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="exclude-reason">
              Reason <span className="text-destructive" aria-hidden>*</span>
            </Label>
            <span className="type-meta tabular-nums text-muted-foreground">
              {reason.length}/{REASON_MAX}
            </span>
          </div>
          <Textarea
            id="exclude-reason"
            value={reason}
            maxLength={REASON_MAX}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="e.g. On extended leave for the cycle"
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <AsyncButton pending={pending} disabled={!trimmed} onClick={submit} variant="destructive">
            {confirmLabel ?? "Exclude employee"}
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
