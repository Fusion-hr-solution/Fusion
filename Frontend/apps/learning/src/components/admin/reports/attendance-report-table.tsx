"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@repo/ui";
import type { AttendanceByEmployeeRow } from "@/types/admin";

export function AttendanceReportTable({
  rows,
  isLoading,
}: {
  rows: AttendanceByEmployeeRow[];
  isLoading: boolean;
}) {
  const t = useTranslations("reports");

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
        {t("empty")}
      </p>
    );
  }

  const totalAttended = rows.reduce((acc, r) => acc + r.attended, 0);
  const totalMissed = rows.reduce((acc, r) => acc + r.missed, 0);
  const totalEnrolled = rows.reduce((acc, r) => acc + r.sessionsEnrolled, 0);
  const overallRate =
    totalAttended + totalMissed > 0
      ? Math.round((totalAttended / (totalAttended + totalMissed)) * 1000) / 10
      : 0;

  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">{t("cols.employee")}</th>
            <th className="px-4 py-2.5 font-medium">{t("cols.grade")}</th>
            <th className="px-4 py-2.5 font-medium">{t("cols.serviceLine")}</th>
            <th className="px-4 py-2.5 text-right font-medium">{t("cols.enrolled")}</th>
            <th className="px-4 py-2.5 text-right font-medium">{t("cols.attended")}</th>
            <th className="px-4 py-2.5 text-right font-medium">{t("cols.missed")}</th>
            <th className="px-4 py-2.5 text-right font-medium">{t("cols.rate")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.employeeId} className="border-b border-border/40 last:border-0">
              <td className="px-4 py-2.5">
                <span className="font-medium text-foreground">{r.employeeName ?? "—"}</span>
                {r.email ? <span className="block text-xs text-muted-foreground">{r.email}</span> : null}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">{r.gradeName}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{r.serviceLineName}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{r.sessionsEnrolled}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600">{r.attended}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{r.missed}</td>
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">
                {r.attendanceRate}%
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border/60 bg-muted/30 font-semibold text-foreground">
            <td className="px-4 py-2.5" colSpan={3}>
              {t("total")}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums">{totalEnrolled}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{totalAttended}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{totalMissed}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{overallRate}%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
