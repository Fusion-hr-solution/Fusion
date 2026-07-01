"use client";

import { useTranslations } from "next-intl";
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
import type { CompletionTrendPoint } from "@/types/admin";

interface CompletionTrendChartProps {
  points: CompletionTrendPoint[];
}

export function CompletionTrendChart({ points }: CompletionTrendChartProps) {
  const t = useTranslations("adminDashboard");
  return (
    <div className="ey-animate-fade-up rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-foreground">
        {t("charts.trendTitle")}
      </h3>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={points}
            margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
          >
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="hsl(var(--ey-blue-400))"
                  stopOpacity={0.15}
                />
                <stop
                  offset="100%"
                  stopColor="hsl(var(--ey-blue-400))"
                  stopOpacity={0.02}
                />
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
              formatter={(value: number, name: string) => [
                `${value}%`,
                name === "completionRate" ? t("charts.completionRate") : name,
              ]}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                backgroundColor: "hsl(var(--card))",
                color: "hsl(var(--foreground))",
                fontSize: "12px",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              itemStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Area
              type="monotone"
              dataKey="completionRate"
              fill="url(#trendFill)"
              stroke="none"
            />
            <Line
              type="monotone"
              dataKey="completionRate"
              stroke="hsl(var(--ey-blue-400))"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "hsl(var(--ey-blue-400))", strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--card))" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
