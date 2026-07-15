"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  XCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Badge, Button } from "@repo/ui";
import { useApiMutation } from "@repo/api/react";
import { ApiError } from "@repo/api";
import { toast } from "sonner";
import { useFormatter, useTranslations } from "next-intl";
import { cancelSessionEnrollment } from "@/services/enrollment-service";
import type { MyEnrollmentSession } from "@/types";

interface SessionTimelineCardProps {
  session: MyEnrollmentSession;
  isLast: boolean;
}

export function SessionTimelineCard({ session, isLast }: SessionTimelineCardProps) {
  const t = useTranslations("mySessions");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const [cancelled, setCancelled] = useState(false);
  const startDate = new Date(session.startUtc);
  const endDate = new Date(session.endUtc);
  const isPast = endDate < new Date();
  const isOngoing = startDate <= new Date() && endDate >= new Date();

  const { mutate: doCancel, isLoading: cancelling } = useApiMutation(
    () => cancelSessionEnrollment(session.sessionId),
    {
      onSuccess: () => {
        setCancelled(true);
        toast.success(t("cancelToast.successTitle"), {
          description: t("timelineCancelToast.successDescription", {
            title: session.partTitle,
          }),
        });
      },
      onError: (err) => {
        const message =
          err instanceof ApiError
            ? err.errors.join(". ")
            : t("cancelToast.errorFallback");
        toast.error(t("cancelToast.errorTitle"), { description: message });
      },
    },
  );

  if (cancelled) return null;

  const statusConfig = getStatusConfig(session.status, isPast, isOngoing);
  const canCancel = !isPast && (session.status === "Enrolled" || session.status === "Waitlisted");

  return (
    <div className="relative flex gap-3">
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center">
        <div className={`mt-1 h-3 w-3 rounded-full border-2 ${statusConfig.dotClass}`} />
        {!isLast && <div className="mt-1 flex-1 w-px bg-border/60" />}
      </div>

      {/* Card */}
      <div className={`flex-1 rounded-lg border p-3.5 transition-colors ${statusConfig.cardClass}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {/* Part title + status badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">
                {t("partTitle", {
                  number: session.partOrderIndex + 1,
                  title: session.partTitle,
                })}
              </span>
              <Badge variant={statusConfig.badgeVariant} className="text-[10px] px-1.5 py-0">
                {t(`enrollmentStatus.${statusConfig.labelKey}`)}
              </Badge>
            </div>

            {/* Details grid */}
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>
                  {format.dateTime(startDate, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>
                  {t("timeline.timeRange", {
                    start: format.dateTime(startDate, { hour: "2-digit", minute: "2-digit" }),
                    end: format.dateTime(endDate, { hour: "2-digit", minute: "2-digit" }),
                  })}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>{session.room}</span>
              </div>
              {session.trainerName && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>{session.trainerName}</span>
                </div>
              )}
            </div>

            {session.status === "Waitlisted" && session.waitlistPosition > 0 && (
              <p className="mt-2 text-xs text-[hsl(var(--ey-orange-500))]">
                {t("timeline.waitlistPosition", { position: session.waitlistPosition })}
              </p>
            )}

            <Link
              href={`/my-sessions/${session.sessionId}`}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {t("timeline.viewDetails")} <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>

          {/* Cancel button */}
          {canCancel && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => doCancel()}
              disabled={cancelling}
              aria-label={tCommon("actions.cancel")}
            >
              {cancelling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <>
                  <XCircle className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  {tCommon("actions.cancel")}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function getStatusConfig(
  status: string,
  isPast: boolean,
  isOngoing: boolean,
): {
  dotClass: string;
  cardClass: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
  labelKey: "attended" | "waitlisted" | "inProgress" | "missed" | "confirmed";
} {
  if (status === "Attended") {
    return {
      dotClass: "border-[hsl(var(--ey-green-500))] bg-[hsl(var(--ey-green-500))]",
      cardClass: "border-[hsl(var(--ey-green-500))]/20 bg-[hsl(var(--ey-green-500))]/10",
      badgeVariant: "default",
      labelKey: "attended",
    };
  }
  if (status === "Waitlisted") {
    return {
      dotClass: "border-[hsl(var(--ey-orange-500))] bg-[hsl(var(--ey-orange-500))]",
      cardClass: "border-[hsl(var(--ey-orange-500))]/20 bg-[hsl(var(--ey-orange-500))]/10",
      badgeVariant: "secondary",
      labelKey: "waitlisted",
    };
  }
  if (isOngoing) {
    return {
      dotClass: "border-[hsl(var(--ey-blue-500))] bg-[hsl(var(--ey-blue-500))] animate-pulse",
      cardClass: "border-[hsl(var(--ey-blue-500))]/20 bg-[hsl(var(--ey-blue-500))]/10",
      badgeVariant: "default",
      labelKey: "inProgress",
    };
  }
  if (isPast) {
    return {
      dotClass: "border-muted-foreground/40 bg-muted-foreground/40",
      cardClass: "border-border/40 bg-muted/20 opacity-70",
      badgeVariant: "outline",
      labelKey: "missed",
    };
  }
  // Upcoming + Enrolled
  return {
    dotClass: "border-primary bg-primary",
    cardClass: "border-primary/20 bg-primary/5",
    badgeVariant: "default",
    labelKey: "confirmed",
  };
}
