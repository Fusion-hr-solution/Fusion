"use client";

import { CalendarPlus, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@repo/ui";
import { Skeleton } from "@repo/ui";
import type { SessionEnrollmentPanelProps } from "@/types/component-props";
import { useSessionEnrollment } from "@/hooks/use-session-enrollment";
import { SessionPickerPart } from "./session-picker-part";
import { EnrollmentStatusPanel } from "./enrollment-status-panel";
import { EnrollmentResultDialog } from "./enrollment-result-dialog";

export function SessionEnrollmentPanel({ trainingId }: SessionEnrollmentPanelProps) {
  const {
    available,
    loadingAvailable,
    myEnrollments,
    loadingMyEnrollments,
    hasActiveEnrollments,
    selections,
    selectSession,
    selectableParts,
    allPartsSelected,
    doEnroll,
    enrolling,
    enrollResult,
    resetEnrollResult,
    doCancel,
    cancelling,
  } = useSessionEnrollment(trainingId);

  const isLoading = loadingAvailable || loadingMyEnrollments;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  // Show enrollment status if already enrolled
  if (hasActiveEnrollments && myEnrollments) {
    return (
      <div className="ey-animate-fade-up space-y-4" style={{ animationDelay: "280ms" }}>
        <div>
          <h2 className="text-lg font-semibold text-foreground">My Session Enrollments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your enrollment status for each part of this training.
          </p>
        </div>

        <EnrollmentStatusPanel
          enrollments={myEnrollments}
          onCancelSession={doCancel}
          isCancelling={cancelling}
        />
      </div>
    );
  }

  // Show session picker for new enrollment
  if (!available || available.parts.length === 0) {
    return (
      <div className="ey-animate-fade-up rounded-xl border border-border/50 bg-white p-8 text-center" style={{ animationDelay: "280ms" }}>
        <CalendarPlus className="mx-auto h-8 w-8 text-muted-foreground/40" />
        <p className="mt-2 text-sm text-muted-foreground">
          No sessions are currently available for enrollment.
        </p>
      </div>
    );
  }

  return (
    <div className="ey-animate-fade-up space-y-5" style={{ animationDelay: "280ms" }}>
      <div>
        <h2 className="text-lg font-semibold text-foreground">Choose Your Sessions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select one time slot for each part to complete your enrollment.
        </p>
      </div>

      {/* Selection summary strip */}
      <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
        <p className="text-xs text-primary">
          <span className="font-semibold">
            {Object.keys(selections).length}/{selectableParts.length}
          </span>{" "}
          parts selected
        </p>
        {allPartsSelected && (
          <span className="text-xs font-medium text-emerald-600">All parts ready</span>
        )}
      </div>

      {/* Part pickers */}
      <div className="space-y-3">
        {available.parts.map((part) => (
          <SessionPickerPart
            key={part.partId}
            part={part}
            selectedSessionId={selections[part.partId] ?? null}
            onSelect={(sessionId) => selectSession(part.partId, sessionId)}
          />
        ))}
      </div>

      {/* Enroll button */}
      <Button
        onClick={() => doEnroll()}
        disabled={!allPartsSelected || enrolling}
        className="w-full gap-2 h-12 text-sm font-semibold shadow-lg transition-all hover:shadow-xl"
      >
        {enrolling ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Enrolling...
          </>
        ) : (
          <>
            <CalendarPlus className="h-4 w-4" />
            Confirm Enrollment
            <ChevronRight className="h-4 w-4" />
          </>
        )}
      </Button>

      <EnrollmentResultDialog
        result={enrollResult}
        trainingTitle={available?.trainingTitle}
        open={!!enrollResult}
        onClose={resetEnrollResult}
      />
    </div>
  );
}
