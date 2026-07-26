"use client";

import { useEffect, useState } from "react";
import type { RaiseDiscussionSignalRequest } from "@repo/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { checkInTerms } from "./check-in-terms";

export function NeedsDiscussionDialog({
  open,
  objectiveTitle,
  objectiveId,
  isSaving,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean;
  objectiveTitle: string;
  objectiveId: string;
  isSaving: boolean;
  error: string | null;
  onSubmit: (request: RaiseDiscussionSignalRequest) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{checkInTerms.raiseTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">{objectiveTitle}</p>
          <div className="space-y-1.5">
            <Label htmlFor="discussion-note">{checkInTerms.raiseNoteLabel}</Label>
            <Textarea
              id="discussion-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={checkInTerms.raiseNotePlaceholder}
              maxLength={1000}
              rows={3}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            {checkInTerms.keep}
          </Button>
          <Button
            type="button"
            disabled={isSaving}
            onClick={() =>
              onSubmit({ objectiveId, note: note.trim() ? note.trim() : null })
            }
          >
            {isSaving ? <Spinner className="size-4" /> : null}
            {isSaving ? checkInTerms.raising : checkInTerms.raiseCta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
