"use client";

import { useTranslations } from "next-intl";
import { Award, CheckCircle2, ShieldX } from "lucide-react";
import { Card, CardContent } from "@repo/ui";
import type { CertificateStats } from "@/types";

interface CertificateStatsCardsProps {
  stats: CertificateStats;
}

export function CertificateStatsCards({ stats }: CertificateStatsCardsProps) {
  const t = useTranslations("adminCertificates");
  const topTraining = [...stats.byTraining].slice(0, 5);
  const recentMonths = [...stats.byMonth].slice(-6);
  const maxMonth = Math.max(1, ...recentMonths.map((m) => m.count));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Kpi
        icon={Award}
        label={t("stats.totalIssued")}
        value={stats.total}
        tone="text-foreground"
      />
      <Kpi
        icon={CheckCircle2}
        label={t("status.valid")}
        value={stats.validCount}
        tone="text-emerald-600"
      />
      <Kpi
        icon={ShieldX}
        label={t("status.revoked")}
        value={stats.revokedCount}
        tone="text-destructive"
      />

      <Card className="lg:col-span-2">
        <CardContent className="p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("stats.issuedByMonth")}
          </p>
          {recentMonths.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("stats.noData")}</p>
          ) : (
            <div className="flex items-end gap-3">
              {recentMonths.map((m) => (
                <div
                  key={m.key}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <span className="text-xs font-medium">{m.count}</span>
                  <div
                    className="w-full rounded-t bg-[hsl(var(--ey-yellow))]"
                    style={{
                      height: `${Math.max(6, (m.count / maxMonth) * 80)}px`,
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {m.key.slice(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("stats.topFormations")}
          </p>
          {topTraining.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("stats.noData")}</p>
          ) : (
            <ul className="space-y-1.5">
              {topTraining.map((t) => (
                <li
                  key={t.key}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate text-foreground">{t.key}</span>
                  <span className="shrink-0 font-semibold text-muted-foreground">
                    {t.count}
                  </span>
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
