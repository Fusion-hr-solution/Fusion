"use client";

import { Clock, MapPin, User, Users, AlertCircle } from "lucide-react";
import { Badge } from "@repo/ui";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@repo/ui";
import type { SessionPickerCardProps } from "@/types/component-props";

function formatSessionTime(startUtc: string, endUtc: string) {
  const start = new Date(startUtc);
  const end = new Date(endUtc);
  const dateStr = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const startTime = start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const endTime = end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return { dateStr, timeRange: `${startTime} – ${endTime}` };
}

export function SessionPickerCard({ session, isSelected, onSelect }: SessionPickerCardProps) {
  const { dateStr, timeRange } = formatSessionTime(session.startUtc, session.endUtc);
  const spotsRatio = session.availableSpots / session.maxCapacity;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={session.isFull}
      className={`group relative w-full rounded-xl border-2 p-4 text-left transition-all ${
        isSelected
          ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/20"
          : session.isFull
            ? "cursor-not-allowed border-border/50 bg-muted/30 opacity-60"
            : "border-border/50 bg-card hover:border-primary/40 hover:shadow-sm"
      }`}
    >
      {isSelected && (
        <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{dateStr}</p>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>{timeRange}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>{session.room}</span>
          </div>

          {session.trainerName && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span>{session.trainerName}</span>
            </div>
          )}
        </div>

        <div className="shrink-0 text-right">
          {session.isFull ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="destructive" className="text-xs">
                    <AlertCircle className="mr-1 h-3 w-3" />
                    Full
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Selecting this session will place you on the waitlist</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span>{session.availableSpots} spots</span>
              </div>
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${
                    spotsRatio > 0.5
                      ? "bg-[hsl(var(--ey-green-500))]"
                      : spotsRatio > 0.2
                        ? "bg-[hsl(var(--ey-orange-500))]"
                        : "bg-destructive"
                  }`}
                  style={{ width: `${Math.max(5, (1 - spotsRatio) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
