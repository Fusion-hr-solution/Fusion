"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
} from "@repo/ui";
import { useApiMutation } from "@repo/api/react";
import { ApiError } from "@repo/api";
import { createTrainingBudget, updateTrainingBudget } from "@/services/admin-service";
import type {
  AdminServiceLine,
  AdminTrainingBudget,
  BudgetPeriodType,
  CreateTrainingBudgetInput,
  UpdateTrainingBudgetInput,
} from "@/types/admin";

interface TrainingBudgetFormProps {
  budget?: AdminTrainingBudget;
  serviceLines: AdminServiceLine[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/** Annual / Quarterly auto-fill a half-open [start, end) range; Custom is admin-set. */
function periodPreset(type: BudgetPeriodType): { start: string; end: string } | null {
  if (type === "Custom") return null;
  const now = new Date();
  const y = now.getFullYear();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (type === "Annual") return { start: `${y}-01-01`, end: `${y + 1}-01-01` };
  const startMonth = Math.floor(now.getMonth() / 3) * 3;
  return {
    start: fmt(new Date(Date.UTC(y, startMonth, 1))),
    end: fmt(new Date(Date.UTC(y, startMonth + 3, 1))),
  };
}

export function TrainingBudgetForm({ budget, serviceLines, open, onOpenChange, onSaved }: TrainingBudgetFormProps) {
  const isEditing = Boolean(budget);
  const [serviceLineId, setServiceLineId] = useState("");
  const [periodType, setPeriodType] = useState<BudgetPeriodType>("Annual");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [allocatedAmount, setAllocatedAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (budget) {
      setServiceLineId(budget.serviceLineId);
      setPeriodType(budget.periodType);
      setPeriodStart(budget.periodStart.slice(0, 10));
      setPeriodEnd(budget.periodEnd.slice(0, 10));
      setAllocatedAmount(budget.allocatedAmount);
    } else {
      const preset = periodPreset("Annual");
      setServiceLineId("");
      setPeriodType("Annual");
      setPeriodStart(preset?.start ?? "");
      setPeriodEnd(preset?.end ?? "");
      setAllocatedAmount(0);
    }
    setError(null);
  }, [budget, open]);

  function handlePeriodTypeChange(value: BudgetPeriodType) {
    setPeriodType(value);
    const preset = periodPreset(value);
    if (preset) {
      setPeriodStart(preset.start);
      setPeriodEnd(preset.end);
    }
  }

  function extractError(err: unknown): string {
    if (err instanceof ApiError) return err.errors[0] ?? err.message;
    if (err instanceof Error) return err.message;
    return "An unexpected error occurred.";
  }

  const { mutateAsync: doCreate, isLoading: creating } = useApiMutation<string, CreateTrainingBudgetInput>(
    (input) => createTrainingBudget(input),
    { onSuccess: () => { onSaved(); onOpenChange(false); }, onError: (err) => setError(extractError(err)) },
  );

  const { mutateAsync: doUpdate, isLoading: updating } = useApiMutation<void, UpdateTrainingBudgetInput>(
    (input) => updateTrainingBudget(budget!.id, input),
    { onSuccess: () => { onSaved(); onOpenChange(false); }, onError: (err) => setError(extractError(err)) },
  );

  const isSaving = creating || updating;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isEditing && !serviceLineId) { setError("Please select a service line."); return; }
    if (!periodStart || !periodEnd) { setError("Please set a start and end date."); return; }
    if (new Date(periodEnd) <= new Date(periodStart)) { setError("Period end must be after period start."); return; }

    if (isEditing) {
      await doUpdate({ periodType, periodStart, periodEnd, allocatedAmount });
    } else {
      await doCreate({ serviceLineId, periodType, periodStart, periodEnd, allocatedAmount });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Budget" : "New Training Budget"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="budget-sl">Service Line *</Label>
            <select
              id="budget-sl"
              required
              disabled={isEditing}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              value={serviceLineId}
              onChange={(e) => setServiceLineId(e.target.value)}
            >
              <option value="">Select a service line</option>
              {serviceLines.map((sl) => (
                <option key={sl.id} value={sl.id}>
                  {sl.name} ({sl.code})
                </option>
              ))}
            </select>
            {isEditing && <p className="text-xs text-muted-foreground">Service line cannot be changed.</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="budget-period-type">Period Type *</Label>
            <select
              id="budget-period-type"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={periodType}
              onChange={(e) => handlePeriodTypeChange(e.target.value as BudgetPeriodType)}
            >
              <option value="Annual">Annual</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Custom">Custom</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="budget-start">Period Start *</Label>
              <Input
                id="budget-start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                disabled={periodType !== "Custom"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget-end">Period End *</Label>
              <Input
                id="budget-end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                disabled={periodType !== "Custom"}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            End date is exclusive. Annual / Quarterly auto-fill the dates.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="budget-amount">Allocated Amount (TND) *</Label>
            <Input
              id="budget-amount"
              type="number"
              min={0}
              step="0.001"
              value={allocatedAmount}
              onChange={(e) => setAllocatedAmount(Number(e.target.value))}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} className="ey-bg-dark hover:opacity-90">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isEditing ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
