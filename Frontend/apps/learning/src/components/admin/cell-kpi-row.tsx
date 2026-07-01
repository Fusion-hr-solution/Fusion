"use client";

import { useTranslations } from "next-intl";
import { Users, TrendingUp, CheckCircle2, BookOpen } from "lucide-react";

function KpiTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className={`rounded-lg p-2 ${accent ?? "bg-muted"}`}>
        <Icon className="h-4 w-4 text-foreground/70" />
      </div>
      <div>
        <p className="text-xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

interface KpiRowProps {
  enrichedCount: number;
  kpis: { avg: number; fully: number; inProg: number } | null;
}

export function CellKpiRow({ enrichedCount, kpis }: KpiRowProps) {
  const t = useTranslations("adminCells");
  const tCommon = useTranslations("common");
  if (!kpis) return null;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiTile
        icon={Users}
        label={t("kpi.totalEmployees")}
        value={enrichedCount}
        accent="bg-[hsl(var(--ey-blue-500))]/10"
      />
      <KpiTile
        icon={TrendingUp}
        label={t("kpi.avgCompletion")}
        value={`${kpis.avg}%`}
        accent="bg-primary/10"
      />
      <KpiTile
        icon={CheckCircle2}
        label={t("kpi.fullyCompleted")}
        value={kpis.fully}
        accent="bg-[hsl(var(--ey-green-500))]/10"
      />
      <KpiTile
        icon={BookOpen}
        label={tCommon("status.in-progress")}
        value={kpis.inProg}
        accent="bg-[hsl(var(--ey-orange-500))]/10"
      />
    </div>
  );
}
