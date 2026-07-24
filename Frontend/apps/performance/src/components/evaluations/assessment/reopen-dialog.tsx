"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, Textarea } from "@repo/ds";
import { evaluationTerms } from "./evaluation-terms";

/**
 * Governed reopen of a submitted self-assessment. Requires a reason that is
 * shared with the employee and audited.
 */
export function ReopenDialog({
  open,
  onOpenChange,
  submitting,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{evaluationTerms.reopenSelf}</DialogTitle>
          <DialogDescription>{evaluationTerms.reopenReasonLabel}</DialogDescription>
        </DialogHeader>
        <Textarea
          aria-label={evaluationTerms.reopenReasonLabel}
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={submitting || reason.trim().length === 0}
            onClick={() => onConfirm(reason.trim())}
          >
            {evaluationTerms.reopenSelf}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
