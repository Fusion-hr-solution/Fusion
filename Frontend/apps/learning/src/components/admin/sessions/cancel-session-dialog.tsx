"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
} from "@repo/ui";
import { useApiMutation } from "@repo/api/react";
import { cancelSession } from "@/services/admin-sessions-service";

interface CancelSessionDialogProps {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled: () => void;
}

export function CancelSessionDialog({
  sessionId,
  open,
  onOpenChange,
  onCancelled,
}: CancelSessionDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { mutateAsync, isLoading } = useApiMutation(
    () => cancelSession(sessionId, { reason }),
    {
      onSuccess: () => { onCancelled(); onOpenChange(false); setReason(""); },
    },
  );

  async function handleConfirm() {
    setError(null);
    if (!reason.trim()) { setError("A reason is required."); return; }
    try { await mutateAsync(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to cancel."); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel Session</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Cancelling will mark the session as cancelled. Enrolled employees will need to be notified separately.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="cancelReason">Reason *</Label>
            <Input
              id="cancelReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
              placeholder="e.g. Trainer unavailable"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Back
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? "Cancelling..." : "Confirm Cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
