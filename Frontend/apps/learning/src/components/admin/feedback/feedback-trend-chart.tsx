"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FeedbackTrendPoint } from "@/types/admin";

interface FeedbackTrendChartProps {
  title: string;
  ratingLabel: string;
  points: FeedbackTrendPoint[];
}

export function FeedbackTrendChart({ title, ratingLabel, points }: FeedbackTrendChartProps) {
  return (
    <div className="ey-animate-fade-up rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="feedbackTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--ey-blue-500))" stopOpacity={0.18} />
                <stop offset="100%" stopColor="hsl(var(--ey-blue-500))" stopOpacity={0.02} />
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
              domain={[0, 5]}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickFormatter={(v: number) => v.toFixed(1)}
            />
            <Tooltip
              formatter={(value: number) => [value.toFixed(2), ratingLabel]}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                fontSize: 12,
              }}
            />
            <Area type="monotone" dataKey="avgOverallRating" fill="url(#feedbackTrendFill)" stroke="none" />
            <Line
              type="monotone"
              dataKey="avgOverallRating"
              stroke="hsl(var(--ey-blue-500))"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
