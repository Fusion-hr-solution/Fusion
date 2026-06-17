"use client";

import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@repo/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@repo/ui";
import type { EnrollInSessionsResult } from "@/types";

interface EnrollmentResultDialogProps {
  result: EnrollInSessionsResult | null;
  trainingTitle?: string;
  open: boolean;
  onClose: () => void;
}

export function EnrollmentResultDialog({ result, trainingTitle, open, onClose }: EnrollmentResultDialogProps) {
  if (!result) return null;

  const enrolled = result.enrollments.filter((e) => e.status === "Enrolled");
  const waitlisted = result.enrollments.filter((e) => e.status === "Waitlisted");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {waitlisted.length === 0 ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-[hsl(var(--ey-green-500))]" />
                Enrollment Confirmed
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-[hsl(var(--ey-orange-500))]" />
                Enrollment Submitted
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {trainingTitle && (
            <p className="text-sm text-foreground font-medium">{trainingTitle}</p>
          )}

          {enrolled.length > 0 && (
            <div className="rounded-lg border border-[hsl(var(--ey-green-500))]/30 bg-[hsl(var(--ey-green-500))]/10 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--ey-green-500))]">
                <CheckCircle2 className="h-4 w-4" />
                {enrolled.length} {enrolled.length === 1 ? "session" : "sessions"} confirmed
              </div>
              <p className="mt-1 text-xs text-[hsl(var(--ey-green-500))]">
                You&apos;re enrolled and your spot is reserved.
              </p>
            </div>
          )}

          {waitlisted.length > 0 && (
            <div className="rounded-lg border border-[hsl(var(--ey-orange-500))]/30 bg-[hsl(var(--ey-orange-500))]/10 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Clock className="h-4 w-4 text-[hsl(var(--ey-orange-500))]" />
                {waitlisted.length} {waitlisted.length === 1 ? "session" : "sessions"} waitlisted
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {waitlisted.map((w) => `Position #${w.waitlistPosition}`).join(", ")}
                {" — "}you&apos;ll be auto-enrolled when a spot opens up.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
