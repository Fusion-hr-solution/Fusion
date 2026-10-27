"use client";

import { useRefusal } from "@/i18n/words";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button, Field, FieldLabel, Skeleton } from "@repo/ds";
import { useFormat } from "@repo/ds/lib/use-format";
import type { PeopleProfileDto } from "@repo/api";
import { usePeopleProfile, useManagerOptions, useWorkforceMaintenanceMutations } from "../api/use-people";
import { ManagerPicker, Segmented } from "./workforce-pickers";
import { TaskShell } from "./task-shell";
import { EffectiveDateField, ConsequencePanel } from "./task-fields";
import { EmployeeIdentity } from "./workforce-ui";

const today = () => new Date().toISOString().slice(0, 10);

export default function ChangeManagerWorkspace({ employeeKey }: { employeeKey: string }) {
  const t = useTranslations("people");
  const profile = usePeopleProfile(employeeKey);

  if (profile.isLoading) {
    return (
      <TaskShell employeeKey={employeeKey} subjectName={null} title={t("changeManager.title")}>
        <div className="space-y-4"><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /></div>
      </TaskShell>
    );
  }
  const employee = profile.data;
  if (!employee) {
    return <TaskShell employeeKey={employeeKey} subjectName={null} title={t("changeManager.title")}><p className="type-body text-muted-foreground">{t("task.notFound")}</p></TaskShell>;
  }
  return <ChangeManagerForm employeeKey={employeeKey} employee={employee} />;
}

function ChangeManagerForm({ employeeKey, employee }: { employeeKey: string; employee: PeopleProfileDto }) {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations("people");
  const refusal = useRefusal();
  const { changeManager } = useWorkforceMaintenanceMutations(employeeKey);

  // Opened from the org chart by a drop: the new manager (by key) and the date come prefilled, and it returns there.
  const fromChart = params.get("back") === "org-chart";
  const prefillDate = params.get("from");
  const prefillManager = params.get("manager");
  const leave = () => router.push(fromChart ? `/org-chart?focus=${encodeURIComponent(employeeKey)}` : `/people/${employeeKey}`);

  const [effectiveDate, setEffectiveDate] = useState(prefillDate && /^\d{4}-\d{2}-\d{2}$/.test(prefillDate) && prefillDate > today() ? prefillDate : today());
  const [mode, setMode] = useState<"Manager" | "None">("Manager");
  const [selected, setSelected] = useState<ManagerOption | null>(null);
  const managerEmployeeId = selected?.employeeId ?? "";
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const options = useManagerOptions(effectiveDate || today(), search);
  const selectable = useMemo(() => withSelected(options.data, selected, employeeKey), [options.data, selected, employeeKey]);
  // The dropped-on manager is looked up by key, so it is found wherever it sorts.
  const prefill = useManagerOptions(effectiveDate || today(), prefillManager ?? "");
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (prefilled || !prefillManager || !prefill.data) return;
    const match = prefill.data.find((option) => option.employeeKey === prefillManager && option.employeeKey !== employeeKey);
    if (match) setSelected(match);
    setPrefilled(true);
  }, [prefilled, prefillManager, prefill.data, employeeKey]);
  const isFuture = effectiveDate > today();

  const current = employee.primaryManager;
  const unchanged =
    (mode === "None" && !current) ||
    (mode === "Manager" && selected?.employeeKey === current?.employeeKey);
  const decided = mode === "None" || Boolean(selected);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (mode === "Manager" && !managerEmployeeId) { setError(t("changeManager.selectError")); return; }
    try {
      await changeManager.mutateAsync({ effectiveDate, managerEmployeeId: mode === "Manager" ? managerEmployeeId : null });
      leave();
    } catch (caught) {
      setError(refusal(caught, t("changeManager.failed")));
    }
  };

  const noManagerLine = <p className="type-body text-muted-foreground">{t("changeManager.noManager")}</p>;
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
          : <p className="type-body">{t("changeManager.choosePreview")}</p>}
    />
  );

  return (
    <TaskShell
      employeeKey={employeeKey}
      subjectName={employee.identity.displayName}
      subjectContext={employee.work ? `${employee.work.jobTitle} · ${employee.work.organizationName}` : null}
      title={t("changeManager.title")}
      aside={preview}
    >
      <form onSubmit={submit} className="space-y-7">
        <EffectiveDateField value={effectiveDate} min={today()} onChange={setEffectiveDate} isFuture={isFuture} />

        <Field>
          <FieldLabel>{t("changeManager.newManager")}</FieldLabel>
          <Segmented
            value={mode}
            onValueChange={setMode}
            label={t("changeManager.selection")}
            options={[
              { value: "Manager", label: t("changeManager.assign") },
              { value: "None", label: t("changeManager.noManager") },
            ]}
          />
          {mode === "Manager" ? (
            <div className="mt-3">
              <ManagerPicker options={selectable} value={managerEmployeeId} onChange={(id) => setSelected(selectable.find((option) => option.employeeId === id) ?? null)} loading={options.isLoading} invalid={false} onQueryChange={setSearch} />
            </div>
          ) : null}
        </Field>

        {error ? <p role="alert" className="type-body text-destructive">{error}</p> : null}

        <div className="flex items-center gap-3 border-t pt-6">
          <Button type="submit" disabled={changeManager.isLoading || unchanged || (mode === "Manager" && !managerEmployeeId)}>
            {isFuture ? t("changeManager.schedule") : t("changeManager.save")}
          </Button>
          <Button type="button" variant="ghost" onClick={leave}>{t("task.cancel")}</Button>
        </div>
      </form>

      <DottedLines employeeKey={employeeKey} employee={employee} effectiveDate={effectiveDate} />
    </TaskShell>
  );
}

type ManagerOption = NonNullable<ReturnType<typeof useManagerOptions>["data"]>[number];

/** Search results without the subject, keeping the chosen manager listed while a new search runs. */
function withSelected(found: ManagerOption[] | undefined, selected: ManagerOption | null, employeeKey: string): ManagerOption[] {
  const options = (found ?? []).filter((option) => option.employeeKey !== employeeKey);
  return selected && !options.some((option) => option.employeeId === selected.employeeId) ? [selected, ...options] : options;
}

/** Dotted-line managers beside the primary chain: end one, or add one, from the task's effective date. */
function DottedLines({
  employeeKey, employee, effectiveDate,
}: {
  employeeKey: string;
  employee: PeopleProfileDto;
  effectiveDate: string;
}) {
  const t = useTranslations("people");
  const refusal = useRefusal();
  const format = useFormat();
  const { dottedLine } = useWorkforceMaintenanceMutations(employeeKey);
  const [adding, setAdding] = useState<ManagerOption | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const options = useManagerOptions(effectiveDate || today(), search);
  const current = employee.dottedLineManagers;
  const addable = withSelected(options.data, adding, employeeKey).filter((option) =>
    option.employeeKey !== employee.primaryManager?.employeeKey
    && !current.some((manager) => manager.employeeKey === option.employeeKey));

  const run = async (managerEmployeeId: string, end: boolean) => {
    setError(null);
    try {
      await dottedLine.mutateAsync({ effectiveDate, managerEmployeeId, end });
      setAdding(null);
      if (effectiveDate > today()) toast.success(t("dottedLines.scheduled", { date: format.date(effectiveDate, { year: "always" }) }));
    } catch (caught) {
      setError(refusal(caught, t("dottedLines.failed")));
    }
  };

  return (
    <section aria-labelledby="dotted-lines" className="mt-10 space-y-4 border-t pt-6">
      <h2 id="dotted-lines" className="type-section-title">{t("dottedLines.title")}</h2>
      {current.length ? (
        <ul className="grid gap-2">
          {current.map((manager) => (
            <li key={manager.employeeKey} className="flex items-center justify-between gap-3 rounded-control bg-inlay px-3 py-2">
              <EmployeeIdentity name={manager.displayName} employeeNumber={manager.employeeNumber} size="sm" />
              <Button type="button" variant="ghost" size="sm" disabled={dottedLine.isLoading} onClick={() => void run(manager.employeeId, true)}>
                {t("dottedLines.end")}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="type-body text-muted-foreground">{t("dottedLines.none")}</p>
      )}
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <ManagerPicker options={addable} value={adding?.employeeId ?? ""} onChange={(id) => setAdding(addable.find((option) => option.employeeId === id) ?? null)} loading={options.isLoading} invalid={false} onQueryChange={setSearch} />
        </div>
        <Button type="button" variant="outline" disabled={!adding || dottedLine.isLoading} onClick={() => adding && void run(adding.employeeId, false)}>
          {t("dottedLines.add")}
        </Button>
      </div>
      {error ? <p role="alert" className="type-body text-destructive">{error}</p> : null}
    </section>
  );
}
