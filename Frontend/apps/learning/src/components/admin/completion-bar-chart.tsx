"use client";

import { useTranslations } from "next-intl";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface CompletionBarChartProps {
  data: { name: string; rate: number; count: number; color?: string }[];
  title: string;
  barColor?: string;
}

function getBarFill(rate: number, defaultColor?: string): string {
  if (defaultColor) return defaultColor;
  if (rate >= 80) return "#10b981";
  if (rate >= 50) return "#f59e0b";
  return "#ef4444";
}

export function CompletionBarChart({
  data,
  title,
  barColor,
}: CompletionBarChartProps) {
  const t = useTranslations("adminDashboard");
  return (
    <div className="ey-animate-fade-up rounded-xl border border-border/60 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#6b7280" }}
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
                t("charts.completion"),
              ]}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="rate" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {data.map((entry, i) => (
                <Cell
                  key={`bar-${i}`}
                  fill={getBarFill(entry.rate, barColor ?? entry.color)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
