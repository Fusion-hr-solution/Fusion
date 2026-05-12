"use client";

import { useState, useCallback, useMemo } from "react";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import { ApiError } from "@repo/api";
import { toast } from "sonner";
import type { SessionSelection, EnrollInSessionsResult } from "@/types";
import {
  getAvailableSessionsForEnrollment,
  enrollInSessions,
  getMySessionEnrollments,
  cancelSessionEnrollment,
} from "@/services/enrollment-service";

function extractErrorMessage(err: Error, fallback: string): string {
  if (err instanceof ApiError) {
    return err.errors.length > 0 ? err.errors.join(". ") : fallback;
  }
  return fallback;
}

export function useSessionEnrollment(trainingId: string) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [enrollResult, setEnrollResult] = useState<EnrollInSessionsResult | null>(null);

  const fetchAvailable = useCallback(
    () => getAvailableSessionsForEnrollment(trainingId),
    [trainingId],
  );

  const fetchMyEnrollments = useCallback(
    () => getMySessionEnrollments(trainingId),
    [trainingId],
  );

  const {
    data: available,
    isLoading: loadingAvailable,
    error: availableError,
    refetch: refetchAvailable,
  } = useApiQuery(fetchAvailable);

  const {
    data: myEnrollments,
    isLoading: loadingMyEnrollments,
    refetch: refetchMyEnrollments,
  } = useApiQuery(fetchMyEnrollments);

  const hasActiveEnrollments = useMemo(() => {
    if (!myEnrollments) return false;
    return myEnrollments.parts.some(
      (p) => p.enrollmentStatus === "Enrolled" || p.enrollmentStatus === "Waitlisted" || p.enrollmentStatus === "Attended",
    );
  }, [myEnrollments]);

  const selectSession = useCallback((partId: string, sessionId: string) => {
    setSelections((prev) => ({ ...prev, [partId]: sessionId }));
  }, []);

  const allPartsSelected = useMemo(() => {
    if (!available) return false;
    return available.parts.every((p) => selections[p.partId]);
  }, [available, selections]);

  const selectionsList: SessionSelection[] = useMemo(
    () => Object.entries(selections).map(([partId, sessionId]) => ({ partId, sessionId })),
    [selections],
  );

  const { mutate: doEnroll, isLoading: enrolling } = useApiMutation(
    () => enrollInSessions(trainingId, selectionsList),
    {
      onSuccess: (result) => {
        setEnrollResult(result);
        refetchMyEnrollments();
        refetchAvailable();

        const waitlisted = result.enrollments.filter((e) => e.status === "Waitlisted");
        if (waitlisted.length === 0) {
          toast.success("Enrollment confirmed", {
            description: "You're enrolled in all sessions.",
          });
        } else {
          toast.warning("Enrollment submitted", {
            description: `${waitlisted.length} ${waitlisted.length === 1 ? "session is" : "sessions are"} on the waitlist.`,
          });
        }
      },
      onError: (err) => {
        toast.error("Enrollment failed", {
          description: extractErrorMessage(err, "Could not complete your enrollment. Please try again."),
        });
      },
    },
  );

  const { mutate: doCancel, isLoading: cancelling } = useApiMutation(
    (sessionId: string) => cancelSessionEnrollment(sessionId),
    {
      onSuccess: () => {
        toast.success("Session cancelled", {
          description: "Your booking has been cancelled successfully.",
        });
        refetchMyEnrollments();
        refetchAvailable();
      },
      onError: (err) => {
        toast.error("Cancellation failed", {
          description: extractErrorMessage(err, "Could not cancel this session. Please try again."),
        });
      },
    },
  );

  const resetEnrollResult = useCallback(() => setEnrollResult(null), []);

  return {
    available,
    loadingAvailable,
    availableError,
    myEnrollments,
    loadingMyEnrollments,
    hasActiveEnrollments,
    selections,
    selectSession,
    allPartsSelected,
    doEnroll,
    enrolling,
    enrollResult,
    resetEnrollResult,
    doCancel,
    cancelling,
  };
}
