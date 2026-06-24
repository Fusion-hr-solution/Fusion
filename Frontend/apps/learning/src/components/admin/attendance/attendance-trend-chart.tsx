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
import type { AttendanceTrendPoint } from "@/types/admin";

interface AttendanceTrendChartProps {
  points: AttendanceTrendPoint[];
}

/** Attendance rate over time (AC#3) — recharts line + area, last 12 months by default. */
export function AttendanceTrendChart({ points }: AttendanceTrendChartProps) {
  return (
    <div className="ey-animate-fade-up rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-foreground">Attendance Rate Trend</h3>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="attendanceTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--ey-green-500))" stopOpacity={0.15} />
                <stop offset="100%" stopColor="hsl(var(--ey-green-500))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              formatter={(value: number) => [`${value}%`, "Attendance Rate"]}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--popover))",
                color: "hsl(var(--popover-foreground))",
                fontSize: "12px",
              }}
            />
            <Area type="monotone" dataKey="attendanceRate" fill="url(#attendanceTrendFill)" stroke="none" />
            <Line
              type="monotone"
              dataKey="attendanceRate"
              stroke="hsl(var(--ey-green-500))"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "hsl(var(--ey-green-500))", strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--card))" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
