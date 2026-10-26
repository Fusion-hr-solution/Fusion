"use client";

import { useRefusal } from "@/i18n/words";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, FieldLabel, Input, Skeleton } from "@repo/ds";
import type { PeopleProfileDto } from "@repo/api";
import { UserRoundX } from "lucide-react";
import { usePeopleProfile, useEndEmploymentPreview, useWorkforceMaintenanceMutations } from "../api/use-people";
import { TaskShell } from "./task-shell";
import { EffectiveDateField, ConsequencePanel, PreviewFact } from "./task-fields";

const today = () => new Date().toISOString().slice(0, 10);

export default function EndEmploymentWorkspace({ employeeKey }: { employeeKey: string }) {
  const t = useTranslations("people");
  const profile = usePeopleProfile(employeeKey);

  if (profile.isLoading) {
    return (
      <TaskShell employeeKey={employeeKey} subjectName={null} title={t("endEmployment.title")}>
        <div className="space-y-4"><Skeleton className="h-11 w-full" /><Skeleton className="h-16 w-full" /></div>
      </TaskShell>
    );
  }
  const employee = profile.data;
  if (!employee || employee.employment.state === "Former") {
    return (
      <TaskShell employeeKey={employeeKey} subjectName={employee?.identity.displayName ?? null} title={t("endEmployment.title")}>
        <p className="type-body text-muted-foreground">{t("endEmployment.noActive")}</p>
      </TaskShell>
    );
  }
  return <EndEmploymentForm employeeKey={employeeKey} employee={employee} />;
}

function EndEmploymentForm({ employeeKey, employee }: { employeeKey: string; employee: PeopleProfileDto }) {
  const router = useRouter();
  const t = useTranslations("people.endEmployment");
  const common = useTranslations("people.task");
  const refusal = useRefusal();
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
      setError(refusal(caught, t("failed")));
    }
  };

  const consequence = (
    <ConsequencePanel
      effectiveDate={lastEmployedDate}
      isFuture={isFuture}
      afterTone="destructive"
      now={
        <div className="space-y-3">
          <PreviewFact label={t("employment")}>{t("active")}</PreviewFact>
          {work ? <PreviewFact label={t("work")}>{work.jobTitle} · {work.organizationName}</PreviewFact> : null}
          <PreviewFact label={t("manager")} muted={!manager}>{manager?.displayName ?? t("noManager")}</PreviewFact>
          <PreviewFact label={t("directReports")} muted={reportCount === 0}>{reportCount === 0 ? t("none") : reportCount}</PreviewFact>
        </div>
      }
      after={
        <div className="space-y-3">
          <PreviewFact label={t("employment")} changed>{t("ended")}</PreviewFact>
          <PreviewFact label={t("work")} changed>{t("noActiveWork")}</PreviewFact>
          <PreviewFact label={t("manager")} changed>{t("noManager")}</PreviewFact>
          {reportCount > 0 ? (
            <PreviewFact label={t("directReports")} changed>
              {t("managerless", { count: reportCount })}
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
      title={t("title")}
      aside={consequence}
    >
      <form onSubmit={submit} className="space-y-7">
        <EffectiveDateField value={lastEmployedDate} min={today()} onChange={setLastEmployedDate} isFuture={isFuture} label={t("lastEmployed")} />

        <Field>
          <FieldLabel htmlFor="note">{t("note")}</FieldLabel>
          <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={common("optional")} />
        </Field>

        {error ? <p role="alert" className="type-body text-destructive">{error}</p> : null}

        <div className="flex items-center gap-3 border-t pt-6">
          <Button type="submit" variant="destructive" disabled={endEmployment.isLoading}>
            <UserRoundX className="size-4" aria-hidden /> {isFuture ? t("schedule") : t("end")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push(`/people/${employeeKey}`)}>{common("cancel")}</Button>
        </div>
      </form>
    </TaskShell>
  );
}
