"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BarChart3, Grid3X3, TrendingUp, Users } from "lucide-react";
import { TooltipProvider, Skeleton } from "@repo/ui";
import {
  useProgrammeMatrix,
  useCompletionByGrade,
  useCompletionByServiceLine,
  useCompletionTrend,
} from "@/hooks/use-programme-dashboard";
import { PageHeader } from "../page-header";
import { KpiCard } from "../kpi-card";
import { ProgrammeMatrixTable } from "./programme-matrix-table";
import { CompletionBarChart } from "./completion-bar-chart";
import { CompletionTrendChart } from "./completion-trend-chart";
import { AttendanceRatesSection } from "./attendance";

export function AdminDashboard() {
  const router = useRouter();
  const t = useTranslations("adminDashboard");
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
    [matrix, router]
  );

  // Compute KPI summary from matrix cells
  const kpis = matrix
    ? (() => {
        const totalCells = matrix.cells.filter(
          (c) => c.employeeCount > 0
        ).length;
        const totalEmployees = matrix.cells.reduce(
          (s, c) => s + c.employeeCount,
          0
        );
        const avgRate =
          totalCells > 0
            ? Math.round(
                matrix.cells.reduce(
                  (s, c) => s + (c.employeeCount > 0 ? c.avgCompletionRate : 0),
                  0
                ) / totalCells
              )
            : 0;
        const greenCells = matrix.cells.filter(
          (c) => c.avgCompletionRate >= 80 && c.employeeCount > 0
        ).length;
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
    <TooltipProvider delayDuration={200}>
      <PageHeader
        moduleTitle={t("moduleTitle")}
        title={t("title")}
        description={t("description")}
      >
        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {loadingMatrix ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] rounded-xl" />
            ))
          ) : (
            <>
              <KpiCard
                icon={Users}
                value={kpis?.totalEmployees ?? 0}
                label={t("kpi.profiledEmployees")}
                index={0}
              />
              <KpiCard
                icon={Grid3X3}
                value={kpis?.totalCells ?? 0}
                label={t("kpi.activeCells")}
                index={1}
              />
              <KpiCard
                icon={TrendingUp}
                value={`${kpis?.avgRate ?? 0}%`}
                label={t("kpi.avgCompletion")}
                index={2}
              />
              <KpiCard
                icon={BarChart3}
                value={kpis?.greenCells ?? 0}
                label={t("kpi.greenCells")}
                index={3}
              />
            </>
          )}
        </div>
      </PageHeader>

      <section className="space-y-8 px-8 py-8">
        {/* ── Programme Matrix ── */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground uppercase tracking-wider">
            {t("matrix.heading")}
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            {t("matrix.hint")}
          </p>
          {loadingMatrix ? (
            <Skeleton className="h-[300px] rounded-xl" />
          ) : matrix ? (
            <ProgrammeMatrixTable
              matrix={matrix}
              onCellClick={handleCellClick}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("matrix.noData")}
            </p>
          )}
        </div>

        {/* ── Bar Charts Row ── */}
        <div className="grid gap-6 lg:grid-cols-2">
          {loadingGrade ? (
            <Skeleton className="h-[320px] rounded-xl" />
          ) : (
            <CompletionBarChart
              data={gradeChartData}
              title={t("charts.byGrade")}
            />
          )}
          {loadingSL ? (
            <Skeleton className="h-[320px] rounded-xl" />
          ) : (
            <CompletionBarChart
              data={slChartData}
              title={t("charts.byServiceLine")}
            />
          )}
        </div>

        {/* ── Trend ── */}
        {loadingTrend ? (
          <Skeleton className="h-[320px] rounded-xl" />
        ) : trend && trend.points.length > 0 ? (
          <CompletionTrendChart points={trend.points} />
        ) : null}

        {/* ── Attendance Rates ── */}
        <AttendanceRatesSection />
      </section>
    </TooltipProvider>
  );
}
