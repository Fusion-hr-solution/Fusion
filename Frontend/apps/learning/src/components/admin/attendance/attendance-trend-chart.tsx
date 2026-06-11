"use client";

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  Line,
} from "recharts";
import { useTranslations } from "next-intl";
import type { AttendanceTrendPoint } from "@/types/admin";

interface AttendanceTrendChartProps {
  points: AttendanceTrendPoint[];
}

/** Attendance rate over time (AC#3) — recharts line + area, last 12 months by default. */
export function AttendanceTrendChart({ points }: AttendanceTrendChartProps) {
  const t = useTranslations("adminAttendance");
  return (
    <div className="ey-animate-fade-up rounded-xl border border-border/60 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-foreground">
        {t("trend.title")}
      </h3>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={points}
            margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
          >
            <defs>
              <linearGradient
                id="attendanceTrendFill"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              formatter={(value: number) => [
                `${value}%`,
                t("trend.tooltipLabel"),
              ]}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                fontSize: "12px",
              }}
            />
            <Area
              type="monotone"
              dataKey="attendanceRate"
              fill="url(#attendanceTrendFill)"
              stroke="none"
            />
            <Line
              type="monotone"
              dataKey="attendanceRate"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
