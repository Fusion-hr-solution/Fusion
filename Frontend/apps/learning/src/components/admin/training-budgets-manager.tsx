"use client";

import { useCallback, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";
import {
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@repo/ui";
import { useApiQuery } from "@repo/api/react";
import { getServiceLines } from "@/services/admin-service";
import { useBudgets } from "@/hooks/use-budgets";
import { formatCurrency } from "@/lib/utils";
import type { AdminServiceLine, AdminTrainingBudget } from "@/types/admin";
import { TrainingBudgetForm } from "./training-budget-form";

function pctClass(p: number): string {
  if (p > 90) return "text-[hsl(var(--ey-red-500))] bg-[hsl(var(--ey-red-500))]/10";
  if (p >= 80) return "text-[hsl(var(--ey-orange-500))] bg-[hsl(var(--ey-orange-500))]/10";
  return "text-[hsl(var(--ey-green-500))] bg-[hsl(var(--ey-green-500))]/10";
}

export function TrainingBudgetsManager() {
  const { budgets, isLoading, refetch, deleteBudget } = useBudgets();

  const fetchServiceLines = useCallback(() => getServiceLines(), []);
  const { data: serviceLines } = useApiQuery<AdminServiceLine[]>(fetchServiceLines, { enabled: true });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminTrainingBudget | undefined>(undefined);

  const slName = useMemo(() => {
    const map = new Map<string, string>();
    (serviceLines ?? []).forEach((sl) => map.set(sl.id, `${sl.name} (${sl.code})`));
    return map;
  }, [serviceLines]);

  const totals = useMemo(
    () =>
      budgets.reduce(
        (acc, b) => ({
          allocated: acc.allocated + b.allocatedAmount,
          spent: acc.spent + b.spend,
          remaining: acc.remaining + b.remaining,
        }),
        { allocated: 0, spent: 0, remaining: 0 },
      ),
    [budgets],
  );

  function openCreate() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function openEdit(b: AdminTrainingBudget) {
    setEditing(b);
    setDialogOpen(true);
  }

  async function handleDelete(b: AdminTrainingBudget) {
    const label = slName.get(b.serviceLineId) ?? "this service line";
    if (!confirm(`Delete the ${b.periodType.toLowerCase()} budget for ${label}?`)) return;
    await deleteBudget(b.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Training Budgets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Allocate external-training budget per service line and period
          </p>
        </div>
        <Button onClick={openCreate} className="ey-bg-dark hover:opacity-90">
          <Plus className="mr-2 h-4 w-4" /> New Budget
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Allocated" value={formatCurrency(totals.allocated)} />
        <StatCard label="Total Spent" value={formatCurrency(totals.spent)} />
        <StatCard label="Total Remaining" value={formatCurrency(totals.remaining)} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          Loading budgets...
        </div>
      ) : budgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Wallet className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No budgets yet</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service Line</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Allocated</TableHead>
                <TableHead className="text-right">Spent</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="text-center">% Used</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgets.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium text-foreground">
                    {slName.get(b.serviceLineId) ?? b.serviceLineId.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <Badge variant="outline" className="mr-2 text-[10px]">
                      {b.periodType}
                    </Badge>
                    {new Date(b.periodStart).toLocaleDateString()} – {new Date(b.periodEnd).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(b.allocatedAmount)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(b.spend)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(b.remaining)}</TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${pctClass(b.percentage)}`}>
                      {b.percentage.toFixed(0)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(b)} aria-label="Edit budget">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(b)}
                        aria-label="Delete budget"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TrainingBudgetForm
        budget={editing}
        serviceLines={serviceLines ?? []}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={refetch}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}
