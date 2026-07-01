import { TrendingUp, AlertTriangle } from "lucide-react";
import type { OverviewKpi } from "@/data/admin-overview";

interface OverviewKpiCardProps {
  kpi: OverviewKpi;
  index?: number;
}

/**
 * Hero KPI tile for the admin Learning Overview — icon + trend-delta pill on
 * top, large tabular value, label beneath. Richer than the employee `KpiCard`
 * (which has no delta), so it lives alongside rather than replacing it.
 */
export function OverviewKpiCard({ kpi, index = 0 }: OverviewKpiCardProps) {
  const { icon: Icon, value, label, delta, trend } = kpi;
  const DeltaIcon = trend === "up" ? TrendingUp : AlertTriangle;
  const deltaClass =
    trend === "up"
      ? "bg-[hsl(var(--ey-green-500))]/10 text-[hsl(var(--ey-green-500))]"
      : "bg-[hsl(var(--ey-orange-500))]/10 text-[hsl(var(--ey-orange-500))]";

  return (
    <div
      className="ey-animate-fade-up group rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
      style={{ animationDelay: `${240 + index * 60}ms` }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted transition-transform duration-300 group-hover:scale-105">
          <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${deltaClass}`}
        >
          <DeltaIcon className="h-3 w-3" aria-hidden="true" />
          {delta}
        </span>
      </div>
      <p className="text-2xl font-bold leading-none text-foreground tabular-nums">
        {value}
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
