"use client";

import { useState, useCallback, useMemo } from "react";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import type { SessionSelection, EnrollInSessionsResult } from "@/types";
import {
  getAvailableSessionsForEnrollment,
  enrollInSessions,
  getMySessionEnrollments,
  cancelSessionEnrollment,
} from "@/services/enrollment-service";

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
      },
    },
  );

  const { mutate: doCancel, isLoading: cancelling } = useApiMutation(
    (sessionId: string) => cancelSessionEnrollment(sessionId),
    {
      onSuccess: () => {
        refetchMyEnrollments();
        refetchAvailable();
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
