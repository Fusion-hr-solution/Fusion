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
  if (rate >= 80) return "hsl(var(--ey-green-500))";
  if (rate >= 50) return "hsl(var(--primary))";
  return "hsl(var(--ey-red-500))";
}

export function CompletionBarChart({
  data,
  title,
  barColor,
}: CompletionBarChartProps) {
  const t = useTranslations("adminDashboard");
  return (
    <div className="ey-animate-fade-up rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
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
              formatter={(value: number) => [
                `${value}%`,
                t("charts.completion"),
              ]}
              contentStyle={{
                borderRadius: "8px",
                background: "hsl(var(--popover))",
                color: "hsl(var(--popover-foreground))",
                border: "1px solid hsl(var(--border))",
                fontSize: "12px",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              itemStyle={{ color: "hsl(var(--foreground))" }}
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
