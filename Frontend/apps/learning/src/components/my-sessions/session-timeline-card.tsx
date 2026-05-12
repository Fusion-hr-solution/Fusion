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
import { cancelSessionEnrollment } from "@/services/enrollment-service";
import type { MyEnrollmentSession } from "@/types";

interface SessionTimelineCardProps {
  session: MyEnrollmentSession;
  isLast: boolean;
}

export function SessionTimelineCard({ session, isLast }: SessionTimelineCardProps) {
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
        toast.success("Session cancelled", {
          description: `"${session.partTitle}" has been removed from your bookings.`,
        });
      },
      onError: (err) => {
        const message =
          err instanceof ApiError
            ? err.errors.join(". ")
            : "Could not cancel this session. Please try again.";
        toast.error("Cancellation failed", { description: message });
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
                Part {session.partOrderIndex + 1}: {session.partTitle}
              </span>
              <Badge variant={statusConfig.badgeVariant} className="text-[10px] px-1.5 py-0">
                {statusConfig.label}
              </Badge>
            </div>

            {/* Details grid */}
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3 shrink-0" />
                <span>
                  {startDate.toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" />
                <span>
                  {startDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  {" – "}
                  {endDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span>{session.room}</span>
              </div>
              {session.trainerName && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="h-3 w-3 shrink-0" />
                  <span>{session.trainerName}</span>
                </div>
              )}
            </div>

            {session.status === "Waitlisted" && session.waitlistPosition > 0 && (
              <p className="mt-2 text-xs text-amber-600">
                Waitlist position: #{session.waitlistPosition}
              </p>
            )}

            <Link
              href={`/my-sessions/${session.sessionId}`}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View details <ExternalLink className="h-3 w-3" />
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
            >
              {cancelling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <XCircle className="mr-1 h-3.5 w-3.5" />
                  Cancel
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
  label: string;
} {
  if (status === "Attended") {
    return {
      dotClass: "border-emerald-500 bg-emerald-500",
      cardClass: "border-emerald-200 bg-emerald-50/50",
      badgeVariant: "default",
      label: "Attended",
    };
  }
  if (status === "Waitlisted") {
    return {
      dotClass: "border-amber-400 bg-amber-400",
      cardClass: "border-amber-200 bg-amber-50/50",
      badgeVariant: "secondary",
      label: "Waitlisted",
    };
  }
  if (isOngoing) {
    return {
      dotClass: "border-blue-500 bg-blue-500 animate-pulse",
      cardClass: "border-blue-200 bg-blue-50/50",
      badgeVariant: "default",
      label: "In Progress",
    };
  }
  if (isPast) {
    return {
      dotClass: "border-muted-foreground/40 bg-muted-foreground/40",
      cardClass: "border-border/40 bg-muted/20 opacity-70",
      badgeVariant: "outline",
      label: "Missed",
    };
  }
  // Upcoming + Enrolled
  return {
    dotClass: "border-primary bg-primary",
    cardClass: "border-primary/20 bg-primary/5",
    badgeVariant: "default",
    label: "Confirmed",
  };
}
