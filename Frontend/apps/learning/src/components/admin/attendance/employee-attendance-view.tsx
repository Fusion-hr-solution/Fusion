"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft, CheckCircle2, XCircle, Clock3, Percent, Timer, CalendarDays } from "lucide-react";
import { Badge, Button, Card, CardContent, Skeleton } from "@repo/ui";
import { useEmployeeAttendanceHistory } from "@/hooks/use-attendance-dashboard";
import { KpiCard } from "../../kpi-card";
import type { AttendanceStatus } from "@/types/admin";

interface EmployeeAttendanceViewProps {
  employeeId: string;
}

function statusBadge(status: AttendanceStatus) {
  switch (status) {
    case "present":
      return (
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="mr-1 h-3 w-3" /> Present
        </Badge>
      );
    case "absent":
      return (
        <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
          <XCircle className="mr-1 h-3 w-3" /> Absent
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
          <Clock3 className="mr-1 h-3 w-3" /> Pending
        </Badge>
      );
  }
}

/** Per-employee attendance history (AC#2): KPI summary + chronological records. */
export function EmployeeAttendanceView({ employeeId }: EmployeeAttendanceViewProps) {
  const { data, isLoading } = useEmployeeAttendanceHistory(employeeId);

  const title = useMemo(
    () => data?.employeeName ?? `Employee ${employeeId.slice(0, 8)}`,
    [data?.employeeName, employeeId],
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/employee-profiles">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Employees
          </Button>
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <h1 className="text-lg font-semibold text-foreground truncate">{title} — Attendance</h1>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">No attendance data available.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <KpiCard icon={Percent} value={`${data.overallAttendanceRate}%`} label="Attendance Rate" index={0} />
            <KpiCard icon={Timer} value={`${data.totalInPersonHours}h`} label="In-person Hours" index={1} />
            <KpiCard icon={CheckCircle2} value={data.presentCount} label="Sessions Attended" index={2} />
            <KpiCard icon={XCircle} value={data.absentCount} label="Sessions Missed" index={3} />
          </div>

          <Card className="border-border/50">
            <CardContent className="py-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Session History</h2>
              {data.records.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <CalendarDays className="h-7 w-7 text-muted-foreground/40" />
                  <p className="mt-2 text-xs text-muted-foreground">No enrolled sessions yet.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {data.records.map((r) => (
                    <li
                      key={r.sessionId}
                      className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/20 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{r.trainingTitle}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.partTitle}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-muted-foreground">
                          {new Date(r.sessionDate).toLocaleDateString()}
                        </p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">{r.hours}h</p>
                      </div>
                      <div className="shrink-0">{statusBadge(r.status)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
