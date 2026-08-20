"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, FieldLabel, Skeleton } from "@repo/ds";
import { ApiError, type PeopleProfileDto } from "@repo/api";
import { usePeopleProfile, useManagerOptions, useWorkforceMaintenanceMutations } from "../api/use-people";
import { ManagerPicker, Segmented } from "./workforce-pickers";
import { TaskShell } from "./task-shell";
import { EffectiveDateField, ConsequencePanel } from "./task-fields";
import { EmployeeIdentity } from "./workforce-ui";

const today = () => new Date().toISOString().slice(0, 10);

export default function ChangeManagerWorkspace({ employeeKey }: { employeeKey: string }) {
  const profile = usePeopleProfile(employeeKey);

  if (profile.isLoading) {
    return (
      <TaskShell employeeKey={employeeKey} subjectName={null} title="Change manager">
        <div className="space-y-4"><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /></div>
      </TaskShell>
    );
  }
  const employee = profile.data;
  if (!employee) {
    return <TaskShell employeeKey={employeeKey} subjectName={null} title="Change manager"><p className="type-body text-muted-foreground">Employee not found.</p></TaskShell>;
  }
  return <ChangeManagerForm employeeKey={employeeKey} employee={employee} />;
}

function ChangeManagerForm({ employeeKey, employee }: { employeeKey: string; employee: PeopleProfileDto }) {
  const router = useRouter();
  const { changeManager } = useWorkforceMaintenanceMutations(employeeKey);

  const [effectiveDate, setEffectiveDate] = useState(today());
  const [mode, setMode] = useState<"Manager" | "None">("Manager");
  const [managerEmployeeId, setManagerEmployeeId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const options = useManagerOptions(effectiveDate || today(), "");
  const selectable = useMemo(
    () => (options.data ?? []).filter((option) => option.employeeKey !== employeeKey),
    [options.data, employeeKey],
  );
  const selected = selectable.find((option) => option.employeeId === managerEmployeeId);
  const isFuture = effectiveDate > today();

  const current = employee.primaryManager;
  const unchanged =
    (mode === "None" && !current) ||
    (mode === "Manager" && selected?.employeeKey === current?.employeeKey);
  const decided = mode === "None" || Boolean(selected);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (mode === "Manager" && !managerEmployeeId) { setError("Select a manager or choose No manager."); return; }
    try {
      await changeManager.mutateAsync({ effectiveDate, managerEmployeeId: mode === "Manager" ? managerEmployeeId : null });
      router.push(`/people/${employeeKey}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The manager change could not be saved.");
    }
  };

  const noManagerLine = <p className="type-body text-muted-foreground">No manager</p>;
  const preview = (
    <ConsequencePanel
      effectiveDate={effectiveDate}
      isFuture={isFuture}
      pending={!decided || unchanged}
      now={current
        ? <EmployeeIdentity name={current.displayName} employeeNumber={current.employeeNumber} size="sm" />
        : noManagerLine}
      after={mode === "None"
        ? noManagerLine
        : selected
          ? <EmployeeIdentity name={selected.displayName} employeeNumber={selected.employeeNumber} secondary={`${selected.jobTitle} · ${selected.organizationName}`} size="sm" />
          : <p className="type-body">Choose a manager to preview the result.</p>}
    />
  );

  return (
    <TaskShell
      employeeKey={employeeKey}
      subjectName={employee.identity.displayName}
      subjectContext={employee.work ? `${employee.work.jobTitle} · ${employee.work.organizationName}` : null}
      title="Change manager"
      aside={preview}
    >
      <form onSubmit={submit} className="space-y-7">
        <EffectiveDateField value={effectiveDate} min={today()} onChange={setEffectiveDate} isFuture={isFuture} />

        <Field>
          <FieldLabel>New manager</FieldLabel>
          <Segmented
            value={mode}
            onValueChange={setMode}
            label="Manager selection"
            options={[{ value: "Manager", label: "Assign a manager" }, { value: "None", label: "No manager" }]}
          />
          {mode === "Manager" ? (
            <div className="mt-3">
              <ManagerPicker options={selectable} value={managerEmployeeId} onChange={setManagerEmployeeId} loading={options.isLoading} invalid={false} />
            </div>
          ) : null}
        </Field>

        {error ? <p role="alert" className="type-body text-destructive">{error}</p> : null}

        <div className="flex items-center gap-3 border-t pt-6">
          <Button type="submit" disabled={changeManager.isLoading || unchanged || (mode === "Manager" && !managerEmployeeId)}>
            {isFuture ? "Schedule manager change" : "Save manager change"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push(`/people/${employeeKey}`)}>Cancel</Button>
        </div>
      </form>
    </TaskShell>
  );
}
