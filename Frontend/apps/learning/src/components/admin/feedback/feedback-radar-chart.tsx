"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface FeedbackRadarChartProps {
  title: string;
  data: { dimension: string; score: number }[];
}

export function FeedbackRadarChart({ title, data }: FeedbackRadarChartProps) {
  return (
    <div className="ey-animate-fade-up rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} margin={{ top: 16, right: 24, bottom: 16, left: 24 }}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 5]}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            />
            <Radar
              dataKey="score"
              stroke="hsl(var(--ey-blue-500))"
              fill="hsl(var(--ey-blue-500))"
              fillOpacity={0.25}
            />
            <Tooltip
              formatter={(value: number) => [value.toFixed(2), ""]}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                fontSize: 12,
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
