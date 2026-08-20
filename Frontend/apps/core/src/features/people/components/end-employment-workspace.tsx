"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, FieldLabel, Input, Skeleton } from "@repo/ds";
import { ApiError, type PeopleProfileDto } from "@repo/api";
import { UserRoundX } from "lucide-react";
import { usePeopleProfile, useEndEmploymentPreview, useWorkforceMaintenanceMutations } from "../api/use-people";
import { TaskShell } from "./task-shell";
import { EffectiveDateField, ConsequencePanel, PreviewFact } from "./task-fields";

const today = () => new Date().toISOString().slice(0, 10);

export default function EndEmploymentWorkspace({ employeeKey }: { employeeKey: string }) {
  const profile = usePeopleProfile(employeeKey);

  if (profile.isLoading) {
    return (
      <TaskShell employeeKey={employeeKey} subjectName={null} title="End employment">
        <div className="space-y-4"><Skeleton className="h-11 w-full" /><Skeleton className="h-16 w-full" /></div>
      </TaskShell>
    );
  }
  const employee = profile.data;
  if (!employee || employee.employment.state === "Former") {
    return (
      <TaskShell employeeKey={employeeKey} subjectName={employee?.identity.displayName ?? null} title="End employment">
        <p className="type-body text-muted-foreground">This employee has no active employment to end.</p>
      </TaskShell>
    );
  }
  return <EndEmploymentForm employeeKey={employeeKey} employee={employee} />;
}

function EndEmploymentForm({ employeeKey, employee }: { employeeKey: string; employee: PeopleProfileDto }) {
  const router = useRouter();
  const { endEmployment } = useWorkforceMaintenanceMutations(employeeKey);

  const [lastEmployedDate, setLastEmployedDate] = useState(today());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const preview = useEndEmploymentPreview(employeeKey, lastEmployedDate);
  const reportCount = preview.data?.directReportCount ?? employee.directReportCount;
  const isFuture = lastEmployedDate > today();
  const work = employee.work;
  const manager = employee.primaryManager;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await endEmployment.mutateAsync({ lastEmployedDate, note: note.trim() || null });
      router.push(`/people/${employeeKey}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The employment could not be ended.");
    }
  };

  const consequence = (
    <ConsequencePanel
      effectiveDate={lastEmployedDate}
      isFuture={isFuture}
      afterTone="destructive"
      now={
        <div className="space-y-3">
          <PreviewFact label="Employment">Active</PreviewFact>
          {work ? <PreviewFact label="Work">{work.jobTitle} · {work.organizationName}</PreviewFact> : null}
          <PreviewFact label="Manager" muted={!manager}>{manager?.displayName ?? "No manager"}</PreviewFact>
          <PreviewFact label="Direct reports" muted={reportCount === 0}>{reportCount === 0 ? "None" : reportCount}</PreviewFact>
        </div>
      }
      after={
        <div className="space-y-3">
          <PreviewFact label="Employment" changed>Ended</PreviewFact>
          <PreviewFact label="Work" changed>No active work</PreviewFact>
          <PreviewFact label="Manager" changed>No manager</PreviewFact>
          {reportCount > 0 ? (
            <PreviewFact label="Direct reports" changed>
              {reportCount} {reportCount === 1 ? "report becomes" : "reports become"} managerless
            </PreviewFact>
          ) : null}
        </div>
      }
    />
  );

  return (
    <TaskShell
      employeeKey={employeeKey}
      subjectName={employee.identity.displayName}
      subjectContext={work ? `${work.jobTitle} · ${work.organizationName}` : null}
      title="End employment"
      aside={consequence}
    >
      <form onSubmit={submit} className="space-y-7">
        <EffectiveDateField value={lastEmployedDate} min={today()} onChange={setLastEmployedDate} isFuture={isFuture} label="Last employed date" />

        <Field>
          <FieldLabel htmlFor="note">Note</FieldLabel>
          <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </Field>

        {error ? <p role="alert" className="type-body text-destructive">{error}</p> : null}

        <div className="flex items-center gap-3 border-t pt-6">
          <Button type="submit" variant="destructive" disabled={endEmployment.isLoading}>
            <UserRoundX className="size-4" aria-hidden /> {isFuture ? "Schedule end" : "End employment"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push(`/people/${employeeKey}`)}>Cancel</Button>
        </div>
      </form>
    </TaskShell>
  );
}
