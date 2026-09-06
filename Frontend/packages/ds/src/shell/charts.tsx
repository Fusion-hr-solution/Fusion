"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "../lib/utils";

/** Gold-family palette from the preset chart tokens. */
export const CHART_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export const CHART_TONES = {
  primary: "var(--primary)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--destructive)",
  info: "var(--info)",
  muted: "var(--muted-foreground)",
} as const;

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--popover-foreground)",
  padding: "6px 10px",
  boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
} as const;

export interface DonutDatum {
  name: string;
  value: number;
  color?: string;
}

/** Donut with a centered total + compact legend. Each slice answers "how much of what". */
export function DonutChart({
  data,
  centerLabel,
  total,
  height = 168,
  className,
}: {
  data: DonutDatum[];
  centerLabel?: string;
  total?: number;
  height?: number;
  className?: string;
}) {
  const computedTotal = total ?? data.reduce((sum, d) => sum + d.value, 0);
  const hasData = data.some((d) => d.value > 0);

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center", className)}>
      <div className="relative shrink-0" style={{ height, width: height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={hasData ? data : [{ name: "None", value: 1 }]}
              dataKey="value"
              innerRadius="64%"
              outerRadius="92%"
              paddingAngle={hasData ? 2 : 0}
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {(hasData ? data : [{ name: "None", value: 1, color: "var(--muted)" }]).map(
                (d, i) => (
                  <Cell
                    key={i}
                    fill={d.color ?? CHART_PALETTE[i % CHART_PALETTE.length]}
                  />
                )
              )}
            </Pie>
            {hasData ? <Tooltip contentStyle={TOOLTIP_STYLE} /> : null}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="type-metric">
            {computedTotal}
          </span>
          {centerLabel ? (
            <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {centerLabel}
            </span>
          ) : null}
        </div>
      </div>
      <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: d.color ?? CHART_PALETTE[i % CHART_PALETTE.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{d.name}</span>
            <span className="font-medium tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A single-value allocation gauge: one donut ring where the filled arc is the allocated share and the
 * remainder reads as a quiet track, with a centered value + label. For "how much of a whole is
 * committed" (plan weight toward 100%, milestone weight, coverage) — not a multi-slice breakdown.
 * Over-allocation fills the whole ring in the given tone. Colour is caller-driven so it can carry
 * semantic state (composing / complete / over).
 */
export function AllocationGauge({
  value,
  max = 100,
  tone = "var(--primary)",
  centerValue,
  centerLabel,
  centerClassName,
  height = 160,
  className,
}: {
  value: number;
  max?: number;
  tone?: string;
  centerValue: string;
  centerLabel?: string;
  centerClassName?: string;
  height?: number;
  className?: string;
}) {
  const allocated = Math.max(0, Math.min(value, max));
  const remaining = Math.max(0, max - value);
  const over = value >= max;
  const data = over
    ? [{ name: "allocated", value: max }]
    : [
        { name: "allocated", value: allocated },
        { name: "remaining", value: remaining },
      ];

  return (
    <div className={cn("relative mx-auto", className)} style={{ height, width: height }}>
      {/* Fixed square: size the chart explicitly rather than via ResponsiveContainer, whose
          ResizeObserver measures a parent that never changes and drives a re-render feedback loop
          ("Maximum update depth exceeded"). The gauge always knows its size (the `height` prop). */}
      <PieChart width={height} height={height}>
        <Pie
          data={data}
          dataKey="value"
          innerRadius="72%"
          outerRadius="100%"
          startAngle={90}
          endAngle={-270}
          stroke="none"
          cornerRadius={allocated > 0 && allocated < max ? 8 : 0}
          paddingAngle={0}
          isAnimationActive={false}
        >
          <Cell fill={tone} />
          {!over ? <Cell fill="var(--muted)" /> : null}
        </Pie>
      </PieChart>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("type-metric leading-none", centerClassName)}>{centerValue}</span>
        {centerLabel ? <span className="mt-1 text-xs text-muted-foreground">{centerLabel}</span> : null}
      </div>
    </div>
  );
}

/** Horizontal bar chart for "count by category" (org units, departments, etc.). */
export function BarChartMini({
  data,
  height = 200,
  color = "var(--chart-1)",
  className,
}: {
  data: Array<{ name: string; value: number }>;
  height?: number;
  color?: string;
  className?: string;
}) {
  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 0, right: 12, top: 0, bottom: 0 }}
          barCategoryGap={6}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={128}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} fill={color} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Vertical column chart for time-series / ordered categories (e.g. hiring by month). */
export function ColumnChart({
  data,
  height = 200,
  color = "var(--chart-1)",
  className,
}: {
  data: Array<{ name: string; value: number }>;
  height?: number;
  color?: string;
  className?: string;
}) {
  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -18, right: 4, top: 8, bottom: 0 }} barCategoryGap={4}>
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            interval={0}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={32}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          />
          <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} fill={color} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Single labeled progress meter for completion-style metrics. */
export function ProgressMeter({
  label,
  value,
  max = 100,
  valueLabel,
  tone = "var(--primary)",
  className,
}: {
  label?: string;
  value: number;
  max?: number;
  valueLabel?: string;
  tone?: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={cn("space-y-1.5", className)}>
      {label || valueLabel ? (
        <div className="flex items-center justify-between text-sm">
          {label ? <span className="text-muted-foreground">{label}</span> : <span />}
          <span className="font-medium tabular-nums">{valueLabel ?? `${pct}%`}</span>
        </div>
      ) : null}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: tone }}
        />
      </div>
    </div>
  );
}
