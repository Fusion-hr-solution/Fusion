"use client";

import { useState } from "react";
import { CalendarPlus, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@repo/ui";
import { Skeleton } from "@repo/ui";
import { useTranslations } from "next-intl";
import type { SessionEnrollmentPanelProps } from "@/types/component-props";
import { useSessionEnrollment } from "@/hooks/use-session-enrollment";
import { SessionPickerPart } from "./session-picker-part";
import { EnrollmentStatusPanel } from "./enrollment-status-panel";
import { EnrollmentResultDialog } from "./enrollment-result-dialog";
import { CancelEnrollmentDialog } from "./cancel-enrollment-dialog";

export function SessionEnrollmentPanel({ trainingId }: SessionEnrollmentPanelProps) {
  const t = useTranslations("trainingDetail");
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
    unenrolledPartsWithSessions,
    allUnenrolledPartsSelected,
  } = useSessionEnrollment(trainingId);

  const [cancelSessionId, setCancelSessionId] = useState<string | null>(null);

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
          <h2 className="text-lg font-semibold text-foreground">{t("sessions.panel.myEnrollmentsTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("sessions.panel.myEnrollmentsSubtitle")}
          </p>
        </div>

        <EnrollmentStatusPanel
          enrollments={myEnrollments}
          onCancelSession={(sessionId) => setCancelSessionId(sessionId)}
          isCancelling={cancelling}
          availableParts={available?.parts}
          selections={selections}
          onSelectSession={selectSession}
        />

        {/* Enroll button for unenrolled parts */}
        {unenrolledPartsWithSessions.length > 0 && (
          <Button
            onClick={() => doEnroll()}
            disabled={!allUnenrolledPartsSelected || enrolling}
            className="w-full gap-2 h-12 text-sm font-semibold shadow-lg transition-all hover:shadow-xl"
          >
            {enrolling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("enroll.enrolling")}
              </>
            ) : (
              <>
                <CalendarPlus className="h-4 w-4" />
                {t("sessions.panel.enrollSelected")}
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        )}

        <EnrollmentResultDialog
          result={enrollResult}
          trainingTitle={myEnrollments.trainingTitle}
          open={!!enrollResult}
          onClose={resetEnrollResult}
        />

        <CancelEnrollmentDialog
          open={!!cancelSessionId}
          onOpenChange={(open) => { if (!open) setCancelSessionId(null); }}
          onConfirm={() => {
            if (cancelSessionId) {
              doCancel(cancelSessionId);
              setCancelSessionId(null);
            }
          }}
          isCancelling={cancelling}
        />
      </div>
    );
  }

  // Show session picker for new enrollment
  if (!available || available.parts.length === 0) {
    return (
      <div className="ey-animate-fade-up rounded-xl border border-border/50 bg-card p-8 text-center" style={{ animationDelay: "280ms" }}>
        <CalendarPlus className="mx-auto h-8 w-8 text-muted-foreground/40" />
        <p className="mt-2 text-sm text-muted-foreground">
          {t("sessions.panel.noSessionsAvailable")}
        </p>
      </div>
    );
  }

  return (
    <div className="ey-animate-fade-up space-y-5" style={{ animationDelay: "280ms" }}>
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("sessions.panel.chooseTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("sessions.panel.chooseSubtitle")}
        </p>
      </div>

      {/* Selection summary strip */}
      <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
        <p className="text-xs text-primary">
          <span className="font-semibold">
            {Object.keys(selections).length}/{selectableParts.length}
          </span>{" "}
          {t("sessions.panel.partsSelected")}
        </p>
        {allPartsSelected && (
          <span className="text-xs font-medium text-emerald-600">{t("sessions.panel.readyToEnroll")}</span>
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
            {t("enroll.enrolling")}
          </>
        ) : (
          <>
            <CalendarPlus className="h-4 w-4" />
            {t("sessions.panel.confirmEnrollment")}
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
