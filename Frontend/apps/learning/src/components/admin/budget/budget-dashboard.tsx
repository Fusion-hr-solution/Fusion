"use client";

import { useCallback, useMemo, useState } from "react";
import { Wallet, TrendingDown, PiggyBank, Percent, AlertTriangle, Download } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@repo/ui";
import { useApiQuery } from "@repo/api/react";
import { getServiceLines } from "@/services/admin-service";
import { useBudgetSummary, useBudgetTrend, useBudgetSpendDetail } from "@/hooks/use-budget-dashboard";
import { exportBudgetReportExcel, exportBudgetReportPdf } from "@/services/budget-dashboard-service";
import { KpiCard } from "@/components/kpi-card";
import { formatCurrency } from "@/lib/utils";
import { downloadBlob } from "@/lib/download";
import { pctBarClass } from "./budget-colors";
import { BudgetVsSpendBarChart } from "./budget-vs-spend-bar-chart";
import { BudgetTrendChart } from "./budget-trend-chart";
import type { AdminServiceLine, BudgetFilters } from "@/types/admin";

const SELECT_CLASS =
  "flex h-9 w-48 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function BudgetDashboard() {
  const [serviceLineId, setServiceLineId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedSl, setSelectedSl] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);

  const filters: BudgetFilters = useMemo(
    () => ({ serviceLineId: serviceLineId || undefined, from: from || undefined, to: to || undefined }),
    [serviceLineId, from, to],
  );
  const detailRange = useMemo(() => ({ from: from || undefined, to: to || undefined }), [from, to]);

  const fetchServiceLines = useCallback(() => getServiceLines(), []);
  const { data: serviceLines } = useApiQuery<AdminServiceLine[]>(fetchServiceLines, { enabled: true });

  const { data: summary, isLoading } = useBudgetSummary(filters);
  const { data: trend } = useBudgetTrend(filters);
  const { data: detail } = useBudgetSpendDetail(selectedSl ?? "", detailRange);

  const rows = summary?.byServiceLine ?? [];

  function reset() {
    setServiceLineId("");
    setFrom("");
    setTo("");
    setSelectedSl(null);
  }

  async function handleExport(format: "excel" | "pdf") {
    setExporting(format);
    try {
      const blob = format === "excel" ? await exportBudgetReportExcel(filters) : await exportBudgetReportPdf(filters);
      const slLabel = serviceLineId
        ? serviceLines?.find((s) => s.id === serviceLineId)?.name ?? "ServiceLine"
        : "All";
      const periodLabel = from && to ? `${from}_${to}` : from ? `from_${from}` : to ? `until_${to}` : "AllTime";
      const slug = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      downloadBlob(blob, `Budget_Training_${slug(slLabel)}_${slug(periodLabel)}.${format === "excel" ? "xlsx" : "pdf"}`);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="space-y-1.5">
          <Label htmlFor="db-sl" className="text-xs">Service Line</Label>
          <select id="db-sl" className={SELECT_CLASS} value={serviceLineId} onChange={(e) => setServiceLineId(e.target.value)}>
            <option value="">All service lines</option>
            {(serviceLines ?? []).map((sl) => (
              <option key={sl.id} value={sl.id}>{sl.name} ({sl.code})</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="db-from" className="text-xs">From</Label>
          <Input id="db-from" type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="db-to" className="text-xs">To</Label>
          <Input id="db-to" type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button variant="ghost" size="sm" onClick={reset}>Reset</Button>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={exporting !== null} onClick={() => handleExport("excel")}>
            <Download className="mr-1.5 h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" disabled={exporting !== null} onClick={() => handleExport("pdf")}>
            <Download className="mr-1.5 h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Threshold alert banner */}
      {summary && summary.alerts.length > 0 && (
        <div className="space-y-2">
          {summary.alerts.map((a) => {
            const danger = a.thresholdBand >= 90;
            const remaining = rows.find((r) => r.serviceLineId === a.serviceLineId)?.remaining ?? 0;
            return (
              <div
                key={a.serviceLineId}
                className={`flex items-center gap-2 rounded-md border p-3 text-sm ${
                  danger
                    ? "border-destructive/30 bg-destructive/5 text-destructive"
                    : "border-[hsl(var(--ey-orange-500))]/30 bg-[hsl(var(--ey-orange-500))]/5 text-[hsl(var(--ey-orange-500))]"
                }`}
              >
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Department {a.serviceLineName} training budget at {a.percentConsumed.toFixed(0)}% —{" "}
                  {formatCurrency(remaining)} remaining
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Wallet} value={formatCurrency(summary?.totalAllocated ?? 0)} label="Total Allocated" index={0} />
        <KpiCard icon={TrendingDown} value={formatCurrency(summary?.totalSpent ?? 0)} label="Total Spent" index={1} />
        <KpiCard icon={PiggyBank} value={formatCurrency(summary?.totalRemaining ?? 0)} label="Remaining" index={2} />
        <KpiCard icon={Percent} value={`${(summary?.percentConsumed ?? 0).toFixed(0)}%`} label="Consumed" index={3} />
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading dashboard...</div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No budgets in the selected period.</div>
      ) : (
        <>
          {/* Per-service-line consumption (click a row to drill into spending) */}
          <div className="space-y-3 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground">Per–Service Line Consumption</h3>
            {rows.map((r) => (
              <button
                key={r.serviceLineId}
                type="button"
                onClick={() => setSelectedSl(r.serviceLineId === selectedSl ? null : r.serviceLineId)}
                className={`block w-full rounded-lg p-2 text-left transition-colors hover:bg-muted/50 ${
                  selectedSl === r.serviceLineId ? "bg-muted/50" : ""
                }`}
              >
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{r.serviceLineName}</span>
                  <span className="text-muted-foreground">
                    {formatCurrency(r.spent)} / {formatCurrency(r.allocated)} · {r.percentConsumed.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${pctBarClass(r.percentConsumed)}`}
                    style={{ width: `${Math.min(r.percentConsumed, 100)}%` }}
                  />
                </div>
              </button>
            ))}
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <BudgetVsSpendBarChart rows={rows} />
            <BudgetTrendChart points={trend?.points ?? []} />
          </div>

          {/* Spending drill-down */}
          {selectedSl && detail && (
            <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                Spending detail — {detail.serviceLineName}
              </h3>
              {detail.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No external sessions in this range.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Training</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Paid to</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.rows.map((row) => (
                      <TableRow key={row.sessionId}>
                        <TableCell className="font-medium text-foreground">{row.trainingTitle}</TableCell>
                        <TableCell className="text-muted-foreground">{new Date(row.startUtc).toLocaleDateString()}</TableCell>
                        <TableCell className="text-muted-foreground">{row.trainerName ?? "—"}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
