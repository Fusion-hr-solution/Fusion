"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@repo/ui";
import type { TrainingHoursRow } from "@/types/admin";

const round = (n: number) => Math.round(n * 100) / 100;

export function HoursReportTable({
  rows,
  isLoading,
}: {
  rows: TrainingHoursRow[];
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

  const totalE = round(rows.reduce((acc, r) => acc + r.eLearningHours, 0));
  const totalInPerson = round(rows.reduce((acc, r) => acc + r.inPersonHours, 0));
  const totalAll = round(rows.reduce((acc, r) => acc + r.totalHours, 0));
  const totalCompleted = rows.reduce((acc, r) => acc + r.trainingsCompleted, 0);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{t("hoursEstimatedNote")}</p>
      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">{t("cols.employee")}</th>
              <th className="px-4 py-2.5 font-medium">{t("cols.grade")}</th>
              <th className="px-4 py-2.5 font-medium">{t("cols.serviceLine")}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t("cols.eLearningHours")}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t("cols.inPersonHours")}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t("cols.totalHours")}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t("cols.completed")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.employeeId} className="border-b border-border/40 last:border-0">
                <td className="px-4 py-2.5 font-medium text-foreground">{r.employeeName ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.gradeName}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.serviceLineName}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.eLearningHours}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.inPersonHours}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">{r.totalHours}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{r.trainingsCompleted}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border/60 bg-muted/30 font-semibold text-foreground">
              <td className="px-4 py-2.5" colSpan={3}>
                {t("total")}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{totalE}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{totalInPerson}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{totalAll}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{totalCompleted}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
