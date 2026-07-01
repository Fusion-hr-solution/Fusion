"use client";

import { useState } from "react";
import { AlertTriangle, UserCheck } from "lucide-react";
import { Button, Input, Label } from "@repo/ds";
import type { CycleReadinessDto } from "@repo/api";
import { useAssignPlanningApprover } from "@/hooks/use-cycles";
import { useEmployeeSearch } from "@/hooks/use-workforce-browse";

export function PlanningApproverReadiness({
  cycleId,
  version,
  readiness,
}: {
  cycleId: string;
  version: number;
  readiness: CycleReadinessDto;
}) {
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const assignApprover = useAssignPlanningApprover(cycleId);
  const employees = useEmployeeSearch(search, participantId !== null && search.trim().length > 1);

  const selected = readiness.unresolvedParticipants.find((participant) => participant.id === participantId);

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Planning readiness</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {readiness.unresolvedPlanningApproverCount === 0
              ? "Every participant has a planning approver."
              : `${readiness.unresolvedPlanningApproverCount} participant${readiness.unresolvedPlanningApproverCount === 1 ? "" : "s"} need an approver before activation.`}
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium">
          {readiness.resolvedPlanningApproverCount}/{readiness.participantCount} resolved
        </span>
      </div>

      {readiness.unresolvedParticipants.map((participant) => (
        <div key={participant.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
          <span className="flex items-center gap-2 text-sm">
            <AlertTriangle className="size-4 text-amber-600" />
            <span>
              <strong>{participant.fullName}</strong>
              <span className="ml-2 text-muted-foreground">No active reporting approver</span>
            </span>
          </span>
          <Button size="sm" variant="outline" onClick={() => setParticipantId(participant.id)}>
            <UserCheck className="size-4" /> Assign approver
          </Button>
        </div>
      ))}

      {selected ? (
        <div className="space-y-3 rounded-lg border border-dashed p-4">
          <p className="text-sm font-medium">Assign approver for {selected.fullName}</p>
          <div className="space-y-1.5">
            <Label htmlFor="planning-approver-search">Find active employee</Label>
            <Input
              id="planning-approver-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email"
            />
          </div>
          {employees.data?.items.map((employee) => (
            <div key={employee.employeeId} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
              <span>{employee.displayName}</span>
              <Button
                size="sm"
                disabled={!reason.trim() || assignApprover.isLoading}
                onClick={() =>
                  assignApprover.mutateAsync({
                    participantId: selected.id,
                    version,
                    body: { approverEmployeeId: employee.employeeId, reason: reason.trim() },
                  }).then(() => {
                    setParticipantId(null);
                    setSearch("");
                    setReason("");
                  }).catch(() => undefined)
                }
              >
                Select
              </Button>
            </div>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="planning-approver-reason">Reason</Label>
            <Input
              id="planning-approver-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why is the normal manager unavailable?"
            />
          </div>
          {assignApprover.error ? <p className="text-sm text-destructive">{assignApprover.error.message}</p> : null}
          <Button variant="ghost" size="sm" onClick={() => setParticipantId(null)}>
            Cancel
          </Button>
        </div>
      ) : null}

      {readiness.unresolvedPlanningApproverCount === 0 ? (
        <p className="flex items-center gap-2 text-sm text-emerald-700"><UserCheck className="size-4" /> Ready to activate.</p>
      ) : null}
    </section>
  );
}
