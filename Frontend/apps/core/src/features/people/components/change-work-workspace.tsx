"use client";

import { useRefusal } from "@/i18n/words";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, FieldLabel, Input, Skeleton } from "@repo/ds";
import type { PeopleProfileDto } from "@repo/api";
import { useOrganizationHierarchy } from "@/features/organization/api/use-organization";
import { usePeopleProfile, useWorkforceMaintenanceMutations } from "../api/use-people";
import { OrganizationPicker, flattenOrg } from "./workforce-pickers";
import { TaskShell } from "./task-shell";
import { EffectiveDateField, ConsequencePanel, PreviewFact } from "./task-fields";
import { OrgPath } from "./workforce-ui";

const today = () => new Date().toISOString().slice(0, 10);

export default function ChangeWorkWorkspace({ employeeKey }: { employeeKey: string }) {
  const t = useTranslations("people");
  const profile = usePeopleProfile(employeeKey);

  if (profile.isLoading) {
    return (
      <TaskShell employeeKey={employeeKey} subjectName={null} title={t("changeWork.title")}>
        <div className="space-y-4"><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /></div>
      </TaskShell>
    );
  }

  const employee = profile.data;
  if (!employee || !employee.work) {
    return (
      <TaskShell employeeKey={employeeKey} subjectName={employee?.identity.displayName ?? null} title={t("changeWork.title")}>
        <p className="type-body text-muted-foreground">
          {t("changeWork.noWork")}
        </p>
      </TaskShell>
    );
  }

  return <ChangeWorkForm employeeKey={employeeKey} employee={employee} />;
}

function ChangeWorkForm({ employeeKey, employee }: { employeeKey: string; employee: PeopleProfileDto }) {
  const router = useRouter();
  const t = useTranslations("people");
  const refusal = useRefusal();
  const work = employee.work!;
  const { changeWork } = useWorkforceMaintenanceMutations(employeeKey);

  const [effectiveDate, setEffectiveDate] = useState(today());
  const [orgUnitId, setOrgUnitId] = useState(work.orgUnitId ?? "");
  const [jobTitle, setJobTitle] = useState(work.jobTitle);
  const [location, setLocation] = useState(work.location ?? "");
  const [error, setError] = useState<string | null>(null);

  const hierarchy = useOrganizationHierarchy(effectiveDate || today(), Boolean(effectiveDate));
  const selectedOrg = useMemo(
    () => flattenOrg(hierarchy.data?.roots ?? []).find((choice) => choice.id === orgUnitId),
    [hierarchy.data, orgUnitId],
  );

  const isFuture = effectiveDate > today();
  const orgChanged = orgUnitId !== (work.orgUnitId ?? "");
  const titleChanged = jobTitle.trim() !== work.jobTitle;
  const locationChanged = (location.trim() || null) !== (work.location ?? null);
  const anythingChanged = orgChanged || titleChanged || locationChanged;

  const afterOrgName = selectedOrg?.name ?? work.organizationName;
  const afterOrgPath = selectedOrg?.path ?? work.organizationPath;
  const afterTitle = jobTitle.trim() || work.jobTitle;
  const afterLocation = location.trim() || null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!orgUnitId) { setError(t("changeWork.selectOrganization")); return; }
    if (!jobTitle.trim()) { setError(t("changeWork.titleRequired")); return; }
    try {
      await changeWork.mutateAsync({ effectiveDate, orgUnitId, jobTitle: jobTitle.trim(), location: location.trim() || null });
      router.push(`/people/${employeeKey}`);
    } catch (caught) {
      setError(refusal(caught, t("changeWork.failed")));
    }
  };

  const preview = (
    <ConsequencePanel
      effectiveDate={effectiveDate}
      isFuture={isFuture}
      pending={!anythingChanged}
      now={
        <div className="space-y-3">
          <PreviewFact label={t("changeWork.jobTitle")}>{work.jobTitle}</PreviewFact>
          <PreviewFact label={t("changeWork.organization")}><OrgPath name={work.organizationName} path={work.organizationPath} showAncestry /></PreviewFact>
          <PreviewFact label={t("changeWork.location")} muted={!work.location}>{work.location ?? t("changeWork.noLocation")}</PreviewFact>
        </div>
      }
      after={
        <div className="space-y-3">
          <PreviewFact label={t("changeWork.jobTitle")} changed={titleChanged}>{afterTitle}</PreviewFact>
          <PreviewFact label={t("changeWork.organization")} changed={orgChanged}><OrgPath name={afterOrgName} path={afterOrgPath} showAncestry /></PreviewFact>
          <PreviewFact label={t("changeWork.location")} changed={locationChanged} muted={!afterLocation && !locationChanged}>{afterLocation ?? t("changeWork.noLocation")}</PreviewFact>
        </div>
      }
    />
  );

  return (
    <TaskShell
      employeeKey={employeeKey}
      subjectName={employee.identity.displayName}
      subjectContext={`${work.jobTitle} · ${work.organizationName}`}
      title={t("changeWork.title")}
      aside={preview}
    >
      <form onSubmit={submit} className="space-y-7">
        <EffectiveDateField value={effectiveDate} min={today()} onChange={setEffectiveDate} isFuture={isFuture} />

        <div className="space-y-5">
          <Field>
            <FieldLabel>{t("changeWork.organization")}</FieldLabel>
            <OrganizationPicker roots={hierarchy.data?.roots ?? []} value={orgUnitId} onChange={setOrgUnitId} invalid={false} />
          </Field>

          <Field>
            <FieldLabel htmlFor="jobTitle">{t("changeWork.displayTitle")}</FieldLabel>
            <Input id="jobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </Field>

          <Field>
            <FieldLabel htmlFor="location">{t("changeWork.location")}</FieldLabel>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("task.optional")} />
          </Field>
        </div>

        {error ? <p role="alert" className="type-body text-destructive">{error}</p> : null}

        <div className="flex items-center gap-3 border-t pt-6">
          <Button type="submit" disabled={changeWork.isLoading || !anythingChanged}>
            {isFuture ? t("changeWork.schedule") : t("changeWork.save")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push(`/people/${employeeKey}`)}>{t("task.cancel")}</Button>
        </div>
      </form>
    </TaskShell>
  );
}
