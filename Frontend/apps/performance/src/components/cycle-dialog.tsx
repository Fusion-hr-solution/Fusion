"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import type {
  CreatePerformanceCycleRequest,
  PerformanceCycleDetailDto,
  PerformanceCycleType,
} from "@repo/api";

const CYCLE_TYPES: { value: PerformanceCycleType; label: string }[] = [
  { value: "Annual", label: "Annual" },
  { value: "MidYear", label: "Mid-year" },
  { value: "Specific", label: "Specific" },
];

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function toIsoOrNull(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

export interface CycleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycle?: PerformanceCycleDetailDto | null;
  submitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (payload: CreatePerformanceCycleRequest) => void;
}

export function CycleDialog({
  open,
  onOpenChange,
  cycle,
  submitting,
  errorMessage,
  onSubmit,
}: CycleDialogProps) {
  const isEdit = !!cycle;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<PerformanceCycleType>("Annual");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [deadline, setDeadline] = useState("");
  const [validation, setValidation] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(cycle?.name ?? "");
    setDescription(cycle?.description ?? "");
    setType(cycle?.type ?? "Annual");
    setPeriodStart(toDateInput(cycle?.periodStart));
    setPeriodEnd(toDateInput(cycle?.periodEnd));
    setDeadline(toDateInput(cycle?.objectiveSettingDeadline));
    setValidation(null);
  }, [open, cycle]);

  const handleSubmit = () => {
    if (!name.trim()) {
      setValidation("Cycle name is required.");
      return;
    }
    if (!periodStart || !periodEnd) {
      setValidation("Period start and end are required.");
      return;
    }
    if (periodEnd <= periodStart) {
      setValidation("Period end must be after period start.");
      return;
    }
    if (deadline && (deadline < periodStart || deadline > periodEnd)) {
      setValidation("Objective-setting deadline must fall within the cycle period.");
      return;
    }
    setValidation(null);
    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      type,
      periodStart: toIsoOrNull(periodStart)!,
      periodEnd: toIsoOrNull(periodEnd)!,
      objectiveSettingDeadline: toIsoOrNull(deadline),
      populationIncludeInactive: cycle?.populationIncludeInactive ?? false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit cycle" : "New performance cycle"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the cycle details. Only draft cycles can be edited."
              : "Define the period and cadence. You can set the population next."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cycle-name">Name</Label>
            <Input
              id="cycle-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. FY26 Annual Review"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cycle-description">Description</Label>
            <Input
              id="cycle-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as PerformanceCycleType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CYCLE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cycle-start">Period start</Label>
              <Input
                id="cycle-start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cycle-end">Period end</Label>
              <Input
                id="cycle-end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cycle-deadline">Objective-setting deadline</Label>
            <Input
              id="cycle-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          {(validation || errorMessage) && (
            <p className="text-sm text-destructive">{validation ?? errorMessage}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create cycle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
