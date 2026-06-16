"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { BudgetByServiceLine } from "@/types/admin";
import { formatCurrency } from "@/lib/utils";

const compact = (v: number) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(v);

export function BudgetVsSpendBarChart({ rows }: { rows: BudgetByServiceLine[] }) {
  const data = rows.map((r) => ({ name: r.serviceLineName, allocated: r.allocated, spent: r.spent }));

  return (
    <div className="ey-animate-fade-up rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-foreground">Budget vs Spend by Service Line</h3>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
            <YAxis
              width={64}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickFormatter={compact}
            />
            <Tooltip
              formatter={(value: number, name: string) => [formatCurrency(value), name === "allocated" ? "Allocated" : "Spent"]}
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
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Bar dataKey="allocated" name="Allocated" fill="#cbd5e1" radius={[6, 6, 0, 0]} maxBarSize={36} />
            <Bar dataKey="spent" name="Spent" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
