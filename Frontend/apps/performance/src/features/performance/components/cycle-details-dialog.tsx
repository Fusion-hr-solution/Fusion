"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { CycleSummaryDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ds/components/ui/dialog";
import { Input } from "@repo/ds/components/ui/input";
import { Label } from "@repo/ds/components/ui/label";
import { AsyncButton } from "@repo/ds/shell";

export interface CycleFormValue {
  name: string;
  startDate: string;
  endDate: string;
  planningDeadline?: string;
}

function defaultPlanningDeadline(start: string, end: string): string {
  if (!start) return "";
  const date = new Date(`${start}T00:00:00`);
  date.setDate(date.getDate() + 30);
  const iso = date.toISOString().slice(0, 10);
  return end && iso > end ? end : iso;
}

export function CycleDetailsDialog({
  open,
  onOpenChange,
  cycle,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycle?: CycleSummaryDto;
  onSubmit: (value: Required<CycleFormValue>) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [planningDeadline, setPlanningDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(cycle?.name ?? "");
    setStartDate(cycle?.startDate ?? "");
    setEndDate(cycle?.endDate ?? "");
    setPlanningDeadline(cycle?.planningDeadline ?? "");
  }, [open, cycle]);

  const effectiveDeadline = planningDeadline || defaultPlanningDeadline(startDate, endDate);
  const valid = name.trim().length > 0 && startDate && endDate && endDate > startDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{cycle ? "Edit Cycle details" : "New Performance Cycle"}</DialogTitle>
          <DialogDescription>
            Name the horizon and set its dates. The same process runs for any length.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="cycle-name">Name</Label>
            <Input
              id="cycle-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="FY2026"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cycle-start">Start</Label>
              <Input id="cycle-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cycle-end">End</Label>
              <Input id="cycle-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cycle-deadline">Planning deadline</Label>
            <Input
              id="cycle-deadline"
              type="date"
              value={effectiveDeadline}
              min={startDate || undefined}
              max={endDate || undefined}
              onChange={(event) => setPlanningDeadline(event.target.value)}
            />
          </div>
          {startDate && endDate && endDate <= startDate ? (
            <p className="text-sm text-destructive">The end date must be after the start date.</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <AsyncButton
            pending={submitting}
            disabled={!valid}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onSubmit({
                  name: name.trim(),
                  startDate,
                  endDate,
                  planningDeadline: effectiveDeadline,
                });
                onOpenChange(false);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not save the Cycle.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {cycle ? "Save details" : "Create Cycle"}
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
