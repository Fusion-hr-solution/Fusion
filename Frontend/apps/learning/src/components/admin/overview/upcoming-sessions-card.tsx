import Link from "next/link";
import { CalendarDays, Clock, MapPin, User, ChevronRight } from "lucide-react";
import { OverviewCard } from "./overview-card";
import { EmptyState } from "../../empty-state";
import type { UpcomingSession } from "@/data/admin-overview";

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

interface UpcomingSessionsCardProps {
  sessions: UpcomingSession[];
}

export function UpcomingSessionsCard({ sessions }: UpcomingSessionsCardProps) {
  return (
    <OverviewCard
      icon={CalendarDays}
      title="Upcoming Sessions"
      action={
        <Link
          href="/admin/sessions"
          className="flex items-center gap-1 text-xs font-semibold text-[hsl(var(--ey-blue-600))] transition-colors hover:underline"
        >
          Manage
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      }
    >
      {sessions.length === 0 ? (
        <div className="px-5 py-8">
          <EmptyState
            icon={CalendarDays}
            title="No upcoming sessions"
            subtitle="Scheduled in-person and virtual sessions will appear here."
          />
        </div>
      ) : (
        <div className="ey-stagger-list flex flex-col gap-2.5 p-4">
          {sessions.map((session) => {
            const start = new Date(session.startUtc);
            return (
              <div
                key={session.id}
                className="flex items-center gap-3.5 rounded-xl border border-border/60 bg-muted/40 p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-sm"
              >
                {/* Date chip */}
                <div className="flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center rounded-lg border border-border/60 bg-card">
                  <span className="text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">
                    {start.toLocaleString("en-US", { month: "short" })}
                  </span>
                  <span className="text-lg font-bold leading-none text-foreground tabular-nums">
                    {start.getDate()}
                  </span>
                </div>

                {/* Body */}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <h3 className="truncate text-[13px] font-semibold text-foreground">
                      {session.title}
                    </h3>
                    <span
                      className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        session.virtual
                          ? "bg-[hsl(var(--ey-blue-400))]/10 text-[hsl(var(--ey-blue-600))]"
                          : "bg-[hsl(var(--ey-teal-500))]/10 text-[hsl(var(--ey-teal-500))]"
                      }`}
                    >
                      {session.virtual ? "Virtual" : "In-Person"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {timeOf(session.startUtc)}–{timeOf(session.endUtc)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" aria-hidden="true" />
                      {session.room}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" aria-hidden="true" />
                      {session.instructor}
                    </span>
                  </div>
                </div>

                {/* Seats */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-[13px] font-bold tabular-nums text-foreground">
                    {session.filled}/{session.capacity}
                  </p>
                  <p className="text-[10px] text-muted-foreground">seats filled</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </OverviewCard>
  );
}
