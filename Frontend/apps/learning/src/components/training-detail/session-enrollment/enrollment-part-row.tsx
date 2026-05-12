"use client";

import { Calendar, MapPin, User, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { Badge } from "@repo/ui";
import { Button } from "@repo/ui";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@repo/ui";
import type { EnrollmentPartRowProps } from "@/types/component-props";

const STATUS_CONFIG = {
  Enrolled: { label: "Enrolled", icon: CheckCircle2, className: "bg-blue-100 text-blue-700 border-blue-200" },
  Waitlisted: { label: "Waitlisted", icon: Clock, className: "bg-amber-100 text-amber-700 border-amber-200" },
  Attended: { label: "Attended", icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  Cancelled: { label: "Cancelled", icon: XCircle, className: "bg-red-100 text-red-700 border-red-200" },
  NotEnrolled: { label: "Not Enrolled", icon: Clock, className: "bg-muted text-muted-foreground border-border" },
} as const;

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EnrollmentPartRow({ part, onCancel, isCancelling }: EnrollmentPartRowProps) {
  const config = STATUS_CONFIG[part.enrollmentStatus] ?? STATUS_CONFIG.NotEnrolled;
  const StatusIcon = config.icon;
  const canCancel = part.enrollmentStatus === "Enrolled" || part.enrollmentStatus === "Waitlisted";

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border/50 bg-white p-4 transition-all hover:shadow-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
        {part.orderIndex + 1}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium text-foreground truncate">{part.partTitle}</p>

        {part.sessionId && part.sessionStartUtc && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDateTime(part.sessionStartUtc)}
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
          {config.label}
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
              <TooltipContent>Cancel this session</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
