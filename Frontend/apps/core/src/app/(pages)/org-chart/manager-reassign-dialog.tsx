"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { getAvatarStyle, getInitials } from "./org-chart-avatar";
import type { EmployeeOrgChartNodeDto } from "./org-chart.types";
import { useReassignManagerFromChart } from "./use-reassign-manager";

export interface ManagerReassignProposal {
  employee: EmployeeOrgChartNodeDto;
  proposedManager: EmployeeOrgChartNodeDto;
}

interface ManagerReassignDialogProps {
  proposal: ManagerReassignProposal | null;
  showJobTitle: boolean;
  onClose: () => void;
}

export function ManagerReassignDialog({
  proposal,
  showJobTitle,
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
      setError(
        err instanceof Error
          ? err.message
          : "The reassignment could not be completed."
      );
    }
  }

  if (!proposal) return null;

  const { employee, proposedManager } = proposal;
  const targetInactive = proposedManager.employmentStatus !== "Active";
  const reportsMoving = employee.directReportCount;

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move {employee.firstName}</DialogTitle>
          <DialogDescription>
            Confirm the new reporting line for this person.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <PersonRow
            employee={{
              fullName: employee.fullName,
              jobTitle: employee.jobTitle,
              stableEmployeeKey: employee.stableEmployeeKey,
            }}
            showJobTitle={showJobTitle}
          />

          {/* from → to */}
          <div className="flex items-center gap-2">
            <ManagerCell
              label="From"
              name={employee.managerName}
              seed={employee.managerId}
            />
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            <ManagerCell
              label="To"
              name={proposedManager.fullName}
              seed={proposedManager.stableEmployeeKey}
              highlight
            />
          </div>

          {reportsMoving > 0 ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-3.5" />
              {reportsMoving} direct report{reportsMoving === 1 ? "" : "s"} move
              with {employee.firstName}.
            </p>
          ) : null}

          {targetInactive ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>
                {proposedManager.firstName} is inactive — pick an active manager.
              </AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>
                The reassignment was rejected. It may create a reporting loop or
                the target is no longer valid.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading || targetInactive}>
            {isLoading ? (
              <>
                <Spinner className="mr-1.5 size-4" />
                Moving…
              </>
            ) : (
              "Confirm move"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PersonRow({
  employee,
  showJobTitle,
}: {
  employee: { fullName: string; jobTitle: string | null; stableEmployeeKey: string };
  showJobTitle: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
      <Avatar size="lg">
        <AvatarFallback
          style={getAvatarStyle(employee.stableEmployeeKey)}
          className="font-medium"
        >
          {getInitials(employee.fullName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-semibold leading-tight">
          {employee.fullName}
        </p>
        {showJobTitle && employee.jobTitle ? (
          <p className="truncate text-xs text-muted-foreground">
            {employee.jobTitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ManagerCell({
  label,
  name,
  seed,
  highlight,
}: {
  label: string;
  name: string | null;
  seed: string | null;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "min-w-0 flex-1 rounded-xl border border-primary/40 bg-primary/[0.06] p-3"
          : "min-w-0 flex-1 rounded-xl border bg-muted/30 p-3"
      }
    >
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {name ? (
        <div className="flex items-center gap-2">
          <Avatar size="sm">
            <AvatarFallback
              style={getAvatarStyle(seed ?? name)}
              className="text-[10px] font-medium"
            >
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 truncate text-sm font-medium">{name}</span>
        </div>
      ) : (
        <span className="text-sm italic text-muted-foreground">No manager</span>
      )}
    </div>
  );
}
