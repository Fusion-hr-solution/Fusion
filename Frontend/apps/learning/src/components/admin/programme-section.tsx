"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Grid3X3, TrendingUp, Users } from "lucide-react";
import { Skeleton } from "@repo/ui";
import {
  useProgrammeMatrix,
  useCompletionByGrade,
  useCompletionByServiceLine,
  useCompletionTrend,
} from "@/hooks/use-programme-dashboard";
import { KpiCard } from "../kpi-card";
import { ProgrammeAttentionList } from "./programme-attention-list";
import { CompletionBarChart } from "./completion-bar-chart";
import { CompletionTrendChart } from "./completion-trend-chart";

/**
 * Programme Matrix dashboard: grade x service-line completion matrix, summary
 * KPIs, completion by grade / service line, and the 12-month trend.
 */
export function ProgrammeSection() {
  const router = useRouter();
  const { data: matrix, isLoading: loadingMatrix } = useProgrammeMatrix();
  const { data: byGrade, isLoading: loadingGrade } = useCompletionByGrade();
  const { data: bySL, isLoading: loadingSL } = useCompletionByServiceLine();
  const { data: trend, isLoading: loadingTrend } = useCompletionTrend();

  const handleCellClick = useCallback(
    (gradeId: string, serviceLineId: string) => {
      if (!matrix) return;
      const grade = matrix.grades.find((g) => g.id === gradeId);
      const sl = matrix.serviceLines.find((s) => s.id === serviceLineId);
      const params = new URLSearchParams({
        gradeId,
        serviceLineId,
        gradeName: grade?.name ?? "",
        serviceLineName: sl?.name ?? "",
      });
      router.push(`/admin/cell-employees?${params.toString()}`);
    },
    [matrix, router],
  );

  const kpis = matrix
    ? (() => {
        const totalCells = matrix.cells.filter((c) => c.employeeCount > 0).length;
        const totalEmployees = matrix.cells.reduce((s, c) => s + c.employeeCount, 0);
        const avgRate =
          totalCells > 0
            ? Math.round(
                matrix.cells.reduce((s, c) => s + (c.employeeCount > 0 ? c.avgCompletionRate : 0), 0) /
                  totalCells,
              )
            : 0;
        const greenCells = matrix.cells.filter((c) => c.avgCompletionRate >= 80 && c.employeeCount > 0).length;
        return { totalEmployees, totalCells, avgRate, greenCells };
      })()
    : null;

  const gradeChartData = (byGrade ?? []).map((g) => ({
    name: g.gradeName,
    rate: g.avgCompletionRate,
    count: g.employeeCount,
  }));

  const slChartData = (bySL ?? []).map((s) => ({
    name: s.serviceLineName,
    rate: s.avgCompletionRate,
    count: s.employeeCount,
    color: s.color,
  }));

  return (
    <div className="space-y-8">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {loadingMatrix ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)
        ) : (
          <>
            <KpiCard icon={Users} value={kpis?.totalEmployees ?? 0} label="Profiled Employees" />
            <KpiCard icon={Grid3X3} value={kpis?.totalCells ?? 0} label="Active Groups" />
            <KpiCard icon={TrendingUp} value={`${kpis?.avgRate ?? 0}%`} label="Avg. Completion" />
            <KpiCard icon={BarChart3} value={kpis?.greenCells ?? 0} label="Groups ≥ 80%" />
          </>
        )}
      </div>

      {/* Completion by group (grade x service line) */}
      <div>
        <h2 className="mb-1 text-sm font-semibold text-foreground">Completion by group</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Each grade × service line group, sorted by lowest completion first. Click a group for
          per-employee progress.
        </p>
        {loadingMatrix ? (
          <Skeleton className="h-[320px] rounded-xl" />
        ) : matrix ? (
          <ProgrammeAttentionList matrix={matrix} onCellClick={handleCellClick} />
        ) : (
          <p className="text-sm text-muted-foreground">No data available.</p>
        )}
      </div>

      {/* Completion charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {loadingGrade ? (
          <Skeleton className="h-[320px] rounded-xl" />
        ) : (
          <CompletionBarChart data={gradeChartData} title="Completion Rate by Grade" />
        )}
        {loadingSL ? (
          <Skeleton className="h-[320px] rounded-xl" />
        ) : (
          <CompletionBarChart data={slChartData} title="Completion Rate by Service Line" />
        )}
      </div>

      {/* Trend */}
      {loadingTrend ? (
        <Skeleton className="h-[320px] rounded-xl" />
      ) : trend && trend.points.length > 0 ? (
        <CompletionTrendChart points={trend.points} />
      ) : null}
    </div>
  );
}
