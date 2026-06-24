"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, Clock3, Percent } from "lucide-react";
import {
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Input,
  Button,
  Skeleton,
} from "@repo/ui";
import { useApiQuery } from "@repo/api/react";
import { getGrades, getServiceLines } from "@/services/admin-config-service";
import {
  useAttendanceSummary,
  useAttendanceByGrade,
  useAttendanceTrend,
  useAttendanceHeatmap,
} from "@/hooks/use-attendance-dashboard";
import type { AdminGrade, AdminServiceLine, AttendanceFilters } from "@/types/admin";
import { KpiCard } from "../../kpi-card";
import { CompletionBarChart } from "../completion-bar-chart";
import { AttendanceTrendChart } from "./attendance-trend-chart";
import { AttendanceHeatmapGrid } from "./attendance-heatmap";

const ALL = "all";

/**
 * "Attendance Rates" dashboard section (AC#3): aggregated attendance KPIs,
 * by-grade bar chart, trend line and grade × month heatmap, all driven by an
 * optional grade / service-line / date-range filter.
 */
export function AttendanceRatesSection() {
  const [gradeId, setGradeId] = useState<string>(ALL);
  const [serviceLineId, setServiceLineId] = useState<string>(ALL);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const filters: AttendanceFilters = useMemo(
    () => ({
      gradeId: gradeId === ALL ? undefined : gradeId,
      serviceLineId: serviceLineId === ALL ? undefined : serviceLineId,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
    }),
    [gradeId, serviceLineId, from, to],
  );

  const { data: grades } = useApiQuery<AdminGrade[]>(getGrades);
  const { data: serviceLines } = useApiQuery<AdminServiceLine[]>(getServiceLines);
  const { data: summary, isLoading: loadingSummary } = useAttendanceSummary(filters);
  const { data: byGrade, isLoading: loadingGrade } = useAttendanceByGrade(filters);
  const { data: trend, isLoading: loadingTrend } = useAttendanceTrend(filters);
  const { data: heatmap, isLoading: loadingHeatmap } = useAttendanceHeatmap(filters);

  const gradeChartData = (byGrade ?? []).map((g) => ({
    name: g.gradeName,
    rate: g.attendanceRate,
    count: g.countedTotal,
  }));

  const hasFilter = gradeId !== ALL || serviceLineId !== ALL || !!from || !!to;

  const resetFilters = () => {
    setGradeId(ALL);
    setServiceLineId(ALL);
    setFrom("");
    setTo("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-foreground">
          Attendance Rates
        </h2>
        <p className="text-xs text-muted-foreground">
          In-person attendance across closed sessions. Absences are derived once a session
          has ended.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="space-y-1.5">
          <Label htmlFor="attendance-filter-grade" className="text-xs">Grade</Label>
          <Select value={gradeId} onValueChange={setGradeId}>
            <SelectTrigger id="attendance-filter-grade" className="h-9 w-[180px]">
              <SelectValue placeholder="All grades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All grades</SelectItem>
              {(grades ?? []).map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="attendance-filter-service-line" className="text-xs">Service Line</Label>
          <Select value={serviceLineId} onValueChange={setServiceLineId}>
            <SelectTrigger id="attendance-filter-service-line" className="h-9 w-[180px]">
              <SelectValue placeholder="All service lines" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All service lines</SelectItem>
              {(serviceLines ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="attendance-filter-from" className="text-xs">From</Label>
          <Input
            id="attendance-filter-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 w-[150px]"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="attendance-filter-to" className="text-xs">To</Label>
          <Input
            id="attendance-filter-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 w-[150px]"
          />
        </div>

        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 text-muted-foreground">
            Reset
          </Button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {loadingSummary ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)
        ) : (
          <>
            <KpiCard icon={Percent} value={`${summary?.overallAttendanceRate ?? 0}%`} label="Overall Rate" index={0} />
            <KpiCard icon={Clock3} value={`${summary?.totalHoursDelivered ?? 0}h`} label="Hours Delivered" index={1} />
            <KpiCard icon={CheckCircle2} value={summary?.totalPresent ?? 0} label="Total Present" index={2} />
            <KpiCard icon={XCircle} value={summary?.totalAbsent ?? 0} label="Total Absent" index={3} />
          </>
        )}
      </div>

      {/* Bar + trend */}
      <div className="grid gap-6 lg:grid-cols-2">
        {loadingGrade ? (
          <Skeleton className="h-[320px] rounded-xl" />
        ) : (
          <CompletionBarChart data={gradeChartData} title="Attendance Rate by Grade" />
        )}
        {loadingTrend ? (
          <Skeleton className="h-[320px] rounded-xl" />
        ) : trend && trend.points.length > 0 ? (
          <AttendanceTrendChart points={trend.points} />
        ) : (
          <div className="flex h-[320px] items-center justify-center rounded-xl border border-border/60 bg-card text-xs text-muted-foreground">
            No attendance trend data for the selected period.
          </div>
        )}
      </div>

      {/* Heatmap */}
      {loadingHeatmap ? (
        <Skeleton className="h-[240px] rounded-xl" />
      ) : heatmap ? (
        <AttendanceHeatmapGrid data={heatmap} />
      ) : null}
    </div>
  );
}
