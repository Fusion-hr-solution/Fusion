"use client";

import { Calendar, MapPin, User, CheckCircle2, Clock, XCircle, Loader2, Info } from "lucide-react";
import { Badge } from "@repo/ui";
import { Button } from "@repo/ui";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@repo/ui";
import { useFormatter, useTranslations } from "next-intl";
import type { EnrollmentPartRowProps } from "@/types/component-props";
import { SessionPickerCard } from "./session-picker-card";

const STATUS_CONFIG = {
  Enrolled: { icon: CheckCircle2, className: "bg-blue-100 text-blue-700 border-blue-200" },
  Waitlisted: { icon: Clock, className: "bg-amber-100 text-amber-700 border-amber-200" },
  Attended: { icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  Cancelled: { icon: XCircle, className: "bg-red-100 text-red-700 border-red-200" },
  NotEnrolled: { icon: Clock, className: "bg-muted text-muted-foreground border-border" },
} as const;

export function EnrollmentPartRow({
  part,
  onCancel,
  isCancelling,
  availableSessions,
  selectedSessionId,
  onSelectSession,
}: EnrollmentPartRowProps) {
  const t = useTranslations("trainingDetail.sessions");
  const format = useFormatter();
  const statusKey: keyof typeof STATUS_CONFIG =
    part.enrollmentStatus in STATUS_CONFIG
      ? (part.enrollmentStatus as keyof typeof STATUS_CONFIG)
      : "NotEnrolled";
  const config = STATUS_CONFIG[statusKey];
  const StatusIcon = config.icon;
  const canCancel = part.enrollmentStatus === "Enrolled" || part.enrollmentStatus === "Waitlisted";
  const showSessions = part.enrollmentStatus === "NotEnrolled" && availableSessions && availableSessions.length > 0;

  // Detect "absent" state: enrolled on a completed session but not attended
  const isAbsent = part.enrollmentStatus === "Enrolled"
    && part.sessionEndUtc
    && new Date(part.sessionEndUtc) < new Date()
    && !part.isAttended;
  const showAbsentSessions = isAbsent && availableSessions && availableSessions.length > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card transition-all hover:shadow-sm">
      <div className="flex items-center gap-4 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
          {part.orderIndex + 1}
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground truncate">{part.partTitle}</p>

          {part.sessionId && part.sessionStartUtc && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format.dateTime(new Date(part.sessionStartUtc), {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {part.room && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {part.room}
                </span>
              )}
              {part.trainerName && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {part.trainerName}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge className={`${config.className} text-xs`}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {t(`status.${statusKey}`)}
          </Badge>

          {canCancel && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => part.sessionId && onCancel(part.sessionId)}
                    disabled={isCancelling}
                  >
                    {isCancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("cancelTooltip")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Absent hint + session picker for re-enrollment */}
      {showAbsentSessions && onSelectSession && (
        <div className="border-t border-border/40 px-4 pb-4 pt-3">
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 mb-3">
            <Info className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700">
              {t("missedHint")}
            </p>
          </div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {t("availableSessions")}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {availableSessions!.map((session) => (
              <SessionPickerCard
                key={session.sessionId}
                session={session}
                isSelected={selectedSessionId === session.sessionId}
                onSelect={() => onSelectSession(session.sessionId)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Inline session picker for unenrolled parts */}
      {showSessions && onSelectSession && (
        <div className="border-t border-border/40 px-4 pb-4 pt-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {t("selectSession")}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {availableSessions.map((session) => (
              <SessionPickerCard
                key={session.sessionId}
                session={session}
                isSelected={selectedSessionId === session.sessionId}
                onSelect={() => onSelectSession(session.sessionId)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
