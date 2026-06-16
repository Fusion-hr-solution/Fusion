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
import type { BudgetTrendPoint } from "@/types/admin";
import { formatCurrency } from "@/lib/utils";

const compact = (v: number) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(v);

export function BudgetTrendChart({ points }: { points: BudgetTrendPoint[] }) {
  return (
    <div className="ey-animate-fade-up rounded-xl border border-border/60 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-foreground">Monthly Spending Trend</h3>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="budgetTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
            <YAxis
              width={64}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
              tickFormatter={compact}
            />
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), "Spend"]}
              contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
            />
            <Area type="monotone" dataKey="spend" fill="url(#budgetTrendFill)" stroke="none" />
            <Line
              type="monotone"
              dataKey="spend"
              stroke="#2563eb"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#2563eb", strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
