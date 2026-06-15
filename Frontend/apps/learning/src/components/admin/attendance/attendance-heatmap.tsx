"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { AttendanceHeatmap } from "@/types/admin";

interface AttendanceHeatmapGridProps {
  data: AttendanceHeatmap;
}

const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

/** Map an attendance rate (0–100) to a Tailwind background + text color. */
function cellStyle(rate: number): string {
  if (rate >= 80) return "bg-emerald-500 text-white";
  if (rate >= 60) return "bg-emerald-300 text-emerald-950";
  if (rate >= 40) return "bg-amber-300 text-amber-950";
  if (rate >= 20) return "bg-orange-400 text-white";
  return "bg-red-500 text-white";
}

/**
 * Attendance rate by grade (rows) × month (columns) rendered as a CSS grid
 * heatmap (decision Q8 — no extra chart dependency). Cells with no closed
 * sessions are left blank.
 */
export function AttendanceHeatmapGrid({ data }: AttendanceHeatmapGridProps) {
  const t = useTranslations("adminAttendance");
  const cellLookup = useMemo(() => {
    const map = new Map<
      string,
      { rate: number; present: number; counted: number }
    >();
    for (const c of data.cells) {
      const key = `${c.gradeId ?? EMPTY_GUID}|${c.year}-${c.month}`;
      map.set(key, {
        rate: c.attendanceRate,
        present: c.presentCount,
        counted: c.countedTotal,
      });
    }
    return map;
  }, [data.cells]);

  if (data.months.length === 0 || data.grades.length === 0) {
    return (
      <div className="flex h-[160px] items-center justify-center rounded-xl border border-border/60 bg-card text-xs text-muted-foreground">
        {t("heatmap.empty")}
      </div>
    );
  }

  return (
    <div className="ey-animate-fade-up overflow-x-auto rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-foreground">
        {t("heatmap.title")}
      </h3>
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `minmax(120px, max-content) repeat(${data.months.length}, minmax(56px, 1fr))`,
        }}
      >
        {/* Header row */}
        <div aria-hidden />
        {data.months.map((m) => (
          <div
            key={`${m.year}-${m.month}`}
            className="px-1 pb-1 text-center text-[10px] font-medium text-muted-foreground"
          >
            {m.label}
          </div>
        ))}

        {/* Grade rows */}
        {data.grades.map((grade) => (
          <div key={grade.id} className="contents">
            <div className="flex items-center pr-2 text-xs font-medium text-foreground truncate">
              {grade.name}
            </div>
            {data.months.map((m) => {
              const entry = cellLookup.get(`${grade.id}|${m.year}-${m.month}`);
              if (!entry) {
                return (
                  <div
                    key={`${grade.id}-${m.year}-${m.month}`}
                    className="flex h-9 items-center justify-center rounded-md bg-muted/40 text-[10px] text-muted-foreground/50"
                  >
                    –
                  </div>
                );
              }
              return (
                <div
                  key={`${grade.id}-${m.year}-${m.month}`}
                  className={`flex h-9 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums ${cellStyle(entry.rate)}`}
                  title={t("heatmap.cellTitle", {
                    grade: grade.name,
                    month: m.label,
                    rate: entry.rate,
                    present: entry.present,
                    counted: entry.counted,
                  })}
                >
                  {Math.round(entry.rate)}%
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
