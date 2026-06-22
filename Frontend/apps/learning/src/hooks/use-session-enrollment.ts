"use client";

import { useState, useCallback, useMemo } from "react";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import { ApiError } from "@repo/api";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("trainingDetail.sessions.toast");
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

  // Parts where employee is NOT enrolled (or absent on completed session) but sessions are available
  const unenrolledPartsWithSessions = useMemo(() => {
    if (!myEnrollments || !available) return [];
    const eligiblePartIds = myEnrollments.parts
      .filter((p) => {
        if (p.enrollmentStatus === "NotEnrolled") return true;
        // Absent: enrolled on completed session but not attended
        if (
          p.enrollmentStatus === "Enrolled" &&
          p.sessionEndUtc &&
          new Date(p.sessionEndUtc) < new Date() &&
          !p.isAttended
        ) return true;
        return false;
      })
      .map((p) => p.partId);
    return available.parts.filter(
      (p) => eligiblePartIds.includes(p.partId) && p.sessions.length > 0,
    );
  }, [myEnrollments, available]);

  const selectSession = useCallback((partId: string, sessionId: string) => {
    setSelections((prev) => ({ ...prev, [partId]: sessionId }));
  }, []);

  const selectableParts = useMemo(
    () => (available ? available.parts.filter((p) => p.sessions.length > 0) : []),
    [available],
  );

  const allPartsSelected = useMemo(() => {
    if (selectableParts.length === 0) return false;
    return selectableParts.some((p) => selections[p.partId]);
  }, [selectableParts, selections]);

  // Check if at least one unenrolled part has a session selected
  const allUnenrolledPartsSelected = useMemo(() => {
    if (unenrolledPartsWithSessions.length === 0) return false;
    return unenrolledPartsWithSessions.some((p) => selections[p.partId]);
  }, [unenrolledPartsWithSessions, selections]);

  // Build selections list: only include unenrolled parts when partially enrolled
  const selectionsList: SessionSelection[] = useMemo(() => {
    if (hasActiveEnrollments) {
      // Only send selections for unenrolled parts
      const unenrolledPartIds = new Set(unenrolledPartsWithSessions.map((p) => p.partId));
      return Object.entries(selections)
        .filter(([partId]) => unenrolledPartIds.has(partId))
        .map(([partId, sessionId]) => ({ partId, sessionId }));
    }
    return Object.entries(selections).map(([partId, sessionId]) => ({ partId, sessionId }));
  }, [selections, hasActiveEnrollments, unenrolledPartsWithSessions]);

  const { mutate: doEnroll, isLoading: enrolling } = useApiMutation(
    () => enrollInSessions(trainingId, selectionsList),
    {
      onSuccess: (result) => {
        setEnrollResult(result);
        refetchMyEnrollments();
        refetchAvailable();

        const waitlisted = result.enrollments.filter((e) => e.status === "Waitlisted");
        if (waitlisted.length === 0) {
          toast.success(t("enrollConfirmedTitle"), {
            description: t("enrollConfirmedDesc"),
          });
        } else {
          toast.warning(t("enrollSubmittedTitle"), {
            description: t("enrollWaitlistedDesc", { count: waitlisted.length }),
          });
        }
      },
      onError: (err) => {
        toast.error(t("enrollFailedTitle"), {
          description: extractErrorMessage(err, t("enrollFailedFallback")),
        });
      },
    },
  );

  const { mutate: doCancel, isLoading: cancelling } = useApiMutation(
    (sessionId: string) => cancelSessionEnrollment(sessionId),
    {
      onSuccess: () => {
        toast.success(t("cancelSuccessTitle"), {
          description: t("cancelSuccessDesc"),
        });
        refetchMyEnrollments();
        refetchAvailable();
      },
      onError: (err) => {
        toast.error(t("cancelFailedTitle"), {
          description: extractErrorMessage(err, t("cancelFailedFallback")),
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
    selectableParts,
    allPartsSelected,
    doEnroll,
    enrolling,
    enrollResult,
    resetEnrollResult,
    doCancel,
    cancelling,
    unenrolledPartsWithSessions,
    allUnenrolledPartsSelected,
  };
}

