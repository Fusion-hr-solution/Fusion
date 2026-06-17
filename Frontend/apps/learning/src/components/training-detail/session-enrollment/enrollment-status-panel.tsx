"use client";

import { CheckCircle2, BarChart3 } from "lucide-react";
import { Progress } from "@repo/ui";
import { useTranslations } from "next-intl";
import type { EnrollmentStatusPanelProps } from "@/types/component-props";
import { EnrollmentPartRow } from "./enrollment-part-row";

export function EnrollmentStatusPanel({
  enrollments,
  onCancelSession,
  isCancelling,
  availableParts,
  selections,
  onSelectSession,
}: EnrollmentStatusPanelProps) {
  const t = useTranslations("trainingDetail.sessions");
  const tCommon = useTranslations("common");
  const progressPct =
    enrollments.totalParts > 0
      ? Math.round((enrollments.completedParts / enrollments.totalParts) * 100)
      : 0;

  return (
    <div className="space-y-5">
      {/* Progress header */}
      <div className="rounded-xl border border-border/50 bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{t("progress.title")}</h3>
          </div>
          {enrollments.isTrainingCompleted && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              {tCommon("status.completed")}
            </span>
          )}
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {t("progress.partsAttended", {
                completed: enrollments.completedParts,
                total: enrollments.totalParts,
              })}
            </span>
            <span className="font-medium">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>
      </div>

      {/* Part-by-part rows */}
      <div className="space-y-2">
        {enrollments.parts.map((part) => {
          const partSessions = availableParts?.find((p) => p.partId === part.partId);
          const isAbsent = part.enrollmentStatus === "Enrolled"
            && part.sessionEndUtc
            && new Date(part.sessionEndUtc) < new Date()
            && !part.isAttended;
          const showPicker = part.enrollmentStatus === "NotEnrolled" || isAbsent;
          return (
            <EnrollmentPartRow
              key={part.partId}
              part={part}
              onCancel={onCancelSession}
              isCancelling={isCancelling}
              availableSessions={showPicker ? partSessions?.sessions : undefined}
              selectedSessionId={selections?.[part.partId] ?? null}
              onSelectSession={
                showPicker && onSelectSession
                  ? (sessionId) => onSelectSession(part.partId, sessionId)
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}
