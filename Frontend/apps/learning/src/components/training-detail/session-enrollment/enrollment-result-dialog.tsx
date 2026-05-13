"use client";

import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@repo/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@repo/ui";
import type { EnrollInSessionsResult } from "@/types";

interface EnrollmentResultDialogProps {
  result: EnrollInSessionsResult | null;
  open: boolean;
  onClose: () => void;
}

export function EnrollmentResultDialog({ result, open, onClose }: EnrollmentResultDialogProps) {
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
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Enrollment Confirmed
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Enrollment Submitted
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {enrolled.length > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                {enrolled.length} {enrolled.length === 1 ? "session" : "sessions"} confirmed
              </div>
              <p className="mt-1 text-xs text-emerald-700">
                You&apos;re enrolled and your spot is reserved.
              </p>
            </div>
          )}

          {waitlisted.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                <Clock className="h-4 w-4" />
                {waitlisted.length} {waitlisted.length === 1 ? "session" : "sessions"} waitlisted
              </div>
              <p className="mt-1 text-xs text-amber-700">
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
