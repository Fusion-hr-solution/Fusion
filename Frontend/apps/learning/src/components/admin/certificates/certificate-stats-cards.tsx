"use client";

import { Award, CheckCircle2, ShieldX } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { Card, CardContent } from "@repo/ui";
import type { CertificateStats } from "@/types";

interface CertificateStatsCardsProps {
  stats: CertificateStats;
}

/** Turn a "YYYY-MM" key into readable short ("Jun") and full ("June 2026") labels. */
function formatMonthKey(key: string): { short: string; full: string } {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return { short: key, full: key };
  const date = new Date(year, month - 1, 1);
  return {
    short: date.toLocaleDateString("en-US", { month: "short" }),
    full: date.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  };
}

export function CertificateStatsCards({ stats }: CertificateStatsCardsProps) {
  const topTraining = [...stats.byTraining].slice(0, 5);
  const monthData = [...stats.byMonth].slice(-6).map((m) => {
    const { short, full } = formatMonthKey(m.key);
    return { short, full, count: m.count };
  });
  const monthTotal = monthData.reduce((sum, m) => sum + m.count, 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Kpi icon={Award} label="Total issued" value={stats.total} tone="text-foreground" />
      <Kpi icon={CheckCircle2} label="Valid" value={stats.validCount} tone="text-[hsl(var(--ey-green-500))]" />
      <Kpi icon={ShieldX} label="Revoked" value={stats.revokedCount} tone="text-destructive" />

      <Card className="lg:col-span-2">
        <CardContent className="p-5">
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Certificates issued · last 6 months
            </p>
            <span className="text-xs text-muted-foreground">
              {monthTotal} total
            </span>
          </div>
          {monthData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthData}
                  margin={{ top: 18, right: 8, bottom: 0, left: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="short"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                    formatter={(value: number) => [
                      `${value} certificate${value === 1 ? "" : "s"}`,
                      "Issued",
                    ]}
                    labelFormatter={(_label, payload) =>
                      payload?.[0]?.payload?.full ?? ""
                    }
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--popover))",
                      color: "hsl(var(--popover-foreground))",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--ey-blue-500))"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  >
                    <LabelList
                      dataKey="count"
                      position="top"
                      offset={6}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        fill: "hsl(var(--foreground))",
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top formations</p>
          {topTraining.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {topTraining.map((t) => (
                <li key={t.key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-foreground">{t.key}</span>
                  <span className="shrink-0 font-semibold text-muted-foreground">{t.count}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Award;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted">
          <Icon className={`h-5 w-5 ${tone}`} aria-hidden="true" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
