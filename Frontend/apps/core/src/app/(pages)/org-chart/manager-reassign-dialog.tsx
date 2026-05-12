"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EmployeeOrgChartNodeDto } from "./org-chart.types";
import { useReassignManagerFromChart } from "./use-reassign-manager";

export interface ManagerReassignProposal {
  employee: EmployeeOrgChartNodeDto;
  proposedManager: EmployeeOrgChartNodeDto;
}

interface ManagerReassignDialogProps {
  proposal: ManagerReassignProposal | null;
  onClose: () => void;
}

export function ManagerReassignDialog({
  proposal,
  onClose,
}: ManagerReassignDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync, isLoading } = useReassignManagerFromChart();

  function handleOpenChange(open: boolean) {
    if (!open) {
      setError(null);
      onClose();
    }
  }

  async function handleConfirm() {
    if (!proposal) return;

    setError(null);
    try {
      await mutateAsync({
        employeeId: proposal.employee.employeeId,
        newManagerId: proposal.proposedManager.employeeId,
        expectedVersion: proposal.employee.version,
      });
      onClose();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "The reassignment could not be completed. Check the details and try again.";
      setError(message);
    }
  }

  if (!proposal) return null;

  const { employee, proposedManager } = proposal;
  const isDowngrade =
    proposedManager.employmentStatus !== "Active";
  const hasDirectReports = employee.directReportCount > 0;

  return (
    <Dialog open={proposal !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reassign manager</DialogTitle>
          <DialogDescription>
            Review the proposed reporting change before confirming. Backend rules
            still apply — cycles, inactive managers, and self-assignment will be
            rejected.
          </DialogDescription>
        </DialogHeader>

        {/* Employee being moved */}
        <div className="rounded-xl border bg-muted/30 p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Employee being moved
          </p>
          <p className="font-semibold">{employee.fullName}</p>
          {employee.jobTitle ? (
            <p className="text-sm text-muted-foreground">{employee.jobTitle}</p>
          ) : null}
          {hasDirectReports ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {employee.directReportCount} direct report
              {employee.directReportCount === 1 ? "" : "s"} will follow this
              person in the hierarchy.
            </p>
          ) : null}
        </div>

        {/* Manager change arrow */}
        <div className="flex items-start gap-3">
          <div className="flex-1 rounded-xl border bg-muted/30 p-4">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current manager
            </p>
            <p className="font-medium">
              {employee.managerName ?? (
                <span className="text-muted-foreground italic">
                  No manager assigned
                </span>
              )}
            </p>
          </div>
          <div className="mt-4 flex shrink-0 items-center">
            <ArrowRight className="size-5 text-muted-foreground" />
          </div>
          <div className="flex-1 rounded-xl border bg-primary/8 p-4">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Proposed manager
            </p>
            <p className="font-medium">{proposedManager.fullName}</p>
            {proposedManager.jobTitle ? (
              <p className="text-xs text-muted-foreground">
                {proposedManager.jobTitle}
              </p>
            ) : null}
            {isDowngrade ? (
              <Badge variant="destructive" className="mt-1.5 text-xs">
                Inactive — will be rejected
              </Badge>
            ) : null}
          </div>
        </div>

        {/* Warnings */}
        {isDowngrade ? (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>
              The proposed manager is inactive. The backend will reject this
              reassignment. Choose an active employee as the new manager.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertDescription>
              Cycles and self-assignment are prevented by the backend. If this
              reassignment would create a reporting loop, it will be rejected.
            </AlertDescription>
          </Alert>
        )}

        {/* Backend error */}
        {error ? (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || isDowngrade}
          >
            {isLoading ? "Reassigning…" : "Confirm reassignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
