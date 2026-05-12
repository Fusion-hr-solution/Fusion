"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  User,
  Mail,
  XCircle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CalendarCheck2,
  Users,
} from "lucide-react";
import { Button, Badge, Card, CardContent, Skeleton } from "@repo/ui";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import { ApiError } from "@repo/api";
import { toast } from "sonner";
import { getAllMyEnrollments, cancelSessionEnrollment } from "@/services/enrollment-service";

interface SessionDetailViewProps {
  sessionId: string;
}

export function SessionDetailView({ sessionId }: SessionDetailViewProps) {
  const [cancelled, setCancelled] = useState(false);
  const fetcher = useCallback(() => getAllMyEnrollments(), []);
  const { data: enrollments, isLoading } = useApiQuery(fetcher);

  const session = useMemo(() => {
    if (!enrollments) return null;
    for (const training of enrollments) {
      const found = training.sessions.find((s) => s.sessionId === sessionId);
      if (found) return { ...found, trainingTitle: training.trainingTitle, trainingId: training.trainingId };
    }
    return null;
  }, [enrollments, sessionId]);

  const { mutate: doCancel, isLoading: cancelling } = useApiMutation(
    () => cancelSessionEnrollment(sessionId),
    {
      onSuccess: () => {
        setCancelled(true);
        toast.success("Session cancelled", {
          description: "Your booking has been cancelled successfully.",
        });
      },
      onError: (err) => {
        const message =
          err instanceof ApiError
            ? err.errors.join(". ")
            : "Could not cancel this session.";
        toast.error("Cancellation failed", { description: message });
      },
    },
  );

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <CalendarCheck2 className="h-12 w-12 text-muted-foreground/30" />
        <p className="mt-4 text-sm font-medium text-foreground">Session not found</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This session may have been cancelled or doesn&apos;t belong to you.
        </p>
        <Link href="/my-sessions">
          <Button variant="outline" size="sm" className="mt-4">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Back to My Sessions
          </Button>
        </Link>
      </div>
    );
  }

  const startDate = new Date(session.startUtc);
  const endDate = new Date(session.endUtc);
  const isPast = endDate < new Date();
  const canCancel = !isPast && !cancelled && (session.status === "Enrolled" || session.status === "Waitlisted");
  const durationHours = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60) * 10) / 10;

  return (
    <div className="space-y-6 p-6">
      {/* Back navigation */}
      <Link
        href="/my-sessions"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to My Sessions
      </Link>

      {/* Main hero card */}
      <Card className="overflow-hidden border-border/50 shadow-md">
        {/* Colored header bar */}
        <div className={`px-6 py-5 ${getHeaderGradient(session.status, isPast)}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-white/80">
                {session.trainingTitle}
              </p>
              <h1 className="mt-1 text-xl font-bold text-white">
                Part {session.partOrderIndex + 1}: {session.partTitle}
              </h1>
            </div>
            <Badge
              className="bg-white/20 text-white border-white/30 text-xs backdrop-blur-sm"
              variant="outline"
            >
              {getStatusLabel(session.status, isPast)}
            </Badge>
          </div>
        </div>

        <CardContent className="p-6">
          {/* Details grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Date */}
            <DetailItem
              icon={<Calendar className="h-4 w-4" />}
              label="Date"
              value={startDate.toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            />
            {/* Time */}
            <DetailItem
              icon={<Clock className="h-4 w-4" />}
              label="Time"
              value={`${startDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} – ${endDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} (${durationHours}h)`}
            />
            {/* Location */}
            <DetailItem
              icon={<MapPin className="h-4 w-4" />}
              label="Room"
              value={session.room}
            />
            {/* Capacity */}
            <DetailItem
              icon={<Users className="h-4 w-4" />}
              label="Capacity"
              value={`${session.maxCapacity} participants max`}
            />
            {/* Trainer */}
            {session.trainerName && (
              <DetailItem
                icon={<User className="h-4 w-4" />}
                label="Trainer"
                value={session.trainerName}
              />
            )}
            {/* Trainer email */}
            {session.trainerEmail && (
              <DetailItem
                icon={<Mail className="h-4 w-4" />}
                label="Contact"
                value={session.trainerEmail}
                isLink
              />
            )}
          </div>

          {/* Waitlist info */}
          {session.status === "Waitlisted" && session.waitlistPosition > 0 && (
            <div className="mt-6 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <p className="text-sm text-amber-800">
                You are <span className="font-semibold">#{session.waitlistPosition}</span> on the waitlist.
                You&apos;ll be automatically enrolled when a spot opens up.
              </p>
            </div>
          )}

          {/* Attended confirmation */}
          {session.status === "Attended" && (
            <div className="mt-6 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <p className="text-sm text-emerald-800">
                Attendance confirmed. This session is complete.
              </p>
            </div>
          )}

          {/* Cancelled confirmation */}
          {cancelled && (
            <div className="mt-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <XCircle className="h-4 w-4 text-red-600" />
              <p className="text-sm text-red-800">
                This session has been cancelled from your bookings.
              </p>
            </div>
          )}

          {/* Actions */}
          {canCancel && (
            <div className="mt-6 flex items-center gap-3 border-t border-border/40 pt-5">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => doCancel()}
                disabled={cancelling}
                className="gap-1.5"
              >
                {cancelling ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                Cancel This Session
              </Button>
              <p className="text-xs text-muted-foreground">
                Cancellation must be made at least 24 hours before the session starts.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enrollment meta */}
      <div className="text-xs text-muted-foreground">
        Enrolled on {new Date(session.enrolledAt).toLocaleDateString(undefined, {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </div>
    </div>
  );
}

function DetailItem({
  icon,
  label,
  value,
  isLink,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  isLink?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        {isLink ? (
          <a
            href={`mailto:${value}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            {value}
          </a>
        ) : (
          <p className="text-sm font-medium text-foreground">{value}</p>
        )}
      </div>
    </div>
  );
}

function getHeaderGradient(status: string, isPast: boolean): string {
  if (status === "Attended") return "bg-gradient-to-r from-emerald-600 to-emerald-500";
  if (status === "Waitlisted") return "bg-gradient-to-r from-amber-600 to-amber-500";
  if (isPast) return "bg-gradient-to-r from-gray-500 to-gray-400";
  return "bg-gradient-to-r from-primary to-primary/80";
}

function getStatusLabel(status: string, isPast: boolean): string {
  if (status === "Attended") return "Attended";
  if (status === "Waitlisted") return "Waitlisted";
  if (isPast) return "Missed";
  return "Confirmed";
}
