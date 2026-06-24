"use client";

import { CheckCircle2, XCircle, Clock3, Percent } from "lucide-react";
import { Card, CardContent, Skeleton } from "@repo/ui";
import { useSessionAttendance } from "@/hooks/use-attendance-dashboard";
import { AttendanceDonutChart } from "./attendance-donut-chart";

interface SessionAttendancePanelProps {
  sessionId: string;
}

const STAT_STYLES: Record<string, string> = {
  present: "text-[hsl(var(--ey-green-500))]",
  absent: "text-[hsl(var(--ey-red-500))]",
  pending: "text-[hsl(var(--ey-orange-500))]",
  rate: "text-[hsl(var(--ey-blue-500))]",
};

/**
 * Per-session attendance summary (AC#1): a recharts donut plus present /
 * absent / pending KPIs. Absence is derived once the session has closed.
 */
export function SessionAttendancePanel({ sessionId }: SessionAttendancePanelProps) {
  const { data, isLoading } = useSessionAttendance(sessionId);

  if (isLoading) {
    return <Skeleton className="h-[280px] rounded-xl" />;
  }
  if (!data) {
    return null;
  }

  const stats = [
    { key: "present", icon: CheckCircle2, label: "Present", value: data.presentCount },
    { key: "absent", icon: XCircle, label: "Absent", value: data.absentCount },
    { key: "pending", icon: Clock3, label: "Pending", value: data.pendingCount },
    { key: "rate", icon: Percent, label: "Attendance Rate", value: `${data.attendanceRate}%` },
  ];

  return (
    <Card className="border-border/50">
      <CardContent className="py-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Attendance</h3>
          <span className="text-xs text-muted-foreground">
            {data.isClosed ? "Session closed" : "Session open"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AttendanceDonutChart
            present={data.presentCount}
            absent={data.absentCount}
            pending={data.pendingCount}
          />
          <div className="grid grid-cols-2 gap-3 self-center">
            {stats.map((s) => (
              <div
                key={s.key}
                className="rounded-xl border border-border/60 bg-muted/20 px-3 py-3"
              >
                <div className="flex items-center gap-1.5">
                  <s.icon className={`h-3.5 w-3.5 ${STAT_STYLES[s.key]}`} aria-hidden="true" />
                  <span className="text-[11px] text-muted-foreground">{s.label}</span>
                </div>
                <p className={`mt-1 text-lg font-bold tabular-nums ${STAT_STYLES[s.key]}`}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {!data.isClosed && (
          <p className="text-[11px] text-muted-foreground">
            Absences are confirmed once the session ends; pending participants have not
            been marked yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
