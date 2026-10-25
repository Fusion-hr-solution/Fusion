"use client";

import { useCallback, useMemo } from "react";
import { ApiError, type FusionSettingsSection, type PeopleDataSettingsDto } from "@repo/api";
import { useSettingsConflictSaver } from "@repo/api/query";
import { useStagedSettings } from "@repo/api/react";
import { Checkbox, cn, Switch } from "@repo/ds";
import {
  PageError,
  SettingsBlock,
  SettingsPage,
  SettingsRow,
  SettingsRows,
  SettingsSaveBar,
  SettingsValue,
} from "@repo/ds/shell";
import {
  usePeopleDataSettings,
  useUpdatePeopleDataSettings,
} from "@/features/settings/api/use-tenant-settings";

type FieldKey = "firstName" | "lastName" | "email" | "hireDate" | "phone" | "jobTitle" | "workLocation" | "employmentType";
type Audience = "required" | "visibleToEmployee" | "visibleToManager";

interface FieldRule {
  required: boolean;
  visibleToEmployee: boolean;
  visibleToManager: boolean;
}

export interface EmployeeFieldsDraft {
  fields: Record<FieldKey, FieldRule>;
  selfService: { canEditPreferredName: boolean; canEditPhone: boolean };
}

/**
 * The fields on a profile, in the order people meet them, with what can't change: names are always required and
 * seen by everyone, work email is always seen, hire date is always required (the server refuses otherwise).
 */
const FIELDS: { key: FieldKey; label: string; noun: string; nouns: string; locked: readonly Audience[] }[] = [
  { key: "firstName", label: "First name", noun: "first name", nouns: "first names", locked: ["required", "visibleToEmployee", "visibleToManager"] },
  { key: "lastName", label: "Last name", noun: "last name", nouns: "last names", locked: ["required", "visibleToEmployee", "visibleToManager"] },
  { key: "email", label: "Work email", noun: "work email", nouns: "work emails", locked: ["visibleToEmployee", "visibleToManager"] },
  { key: "hireDate", label: "Hire date", noun: "hire date", nouns: "hire dates", locked: ["required"] },
  { key: "phone", label: "Phone", noun: "phone number", nouns: "phone numbers", locked: [] },
  { key: "jobTitle", label: "Job title", noun: "job title", nouns: "job titles", locked: [] },
  { key: "workLocation", label: "Work location", noun: "work location", nouns: "work locations", locked: [] },
  { key: "employmentType", label: "Employment type", noun: "employment type", nouns: "employment types", locked: [] },
];

const COLUMNS: { key: Audience; label: string }[] = [
  { key: "required", label: "Required" },
  { key: "visibleToEmployee", label: "The employee" },
  { key: "visibleToManager", label: "Their manager" },
];

const SELF_SERVICE = [
  { key: "canEditPreferredName", label: "Their preferred name", noun: "preferred name" },
  { key: "canEditPhone", label: "Their phone number", noun: "phone number" },
] as const;

export function toDraft(settings: PeopleDataSettingsDto): EmployeeFieldsDraft {
  const fields = Object.fromEntries(
    FIELDS.map((field) => {
      const rule = settings.employeeFieldConfig[field.key];
      return [
        field.key,
        {
          required: rule?.required ?? false,
          visibleToEmployee: rule?.visibleToEmployee ?? true,
          visibleToManager: rule?.visibleToManager ?? true,
        },
      ];
    })
  ) as Record<FieldKey, FieldRule>;
  return { fields, selfService: { ...settings.selfService } };
}

/** What saving does, one sentence per change, at most two before "and N more". */
export function employeeFieldsConsequence(saved: EmployeeFieldsDraft, draft: EmployeeFieldsDraft): string {
  const sentences: string[] = [];
  for (const field of FIELDS) {
    const before = saved.fields[field.key];
    const after = draft.fields[field.key];
    if (before.visibleToManager !== after.visibleToManager) {
      sentences.push(
        after.visibleToManager
          ? `Managers see ${field.nouns} on their team's profiles.`
          : `Managers stop seeing ${field.nouns} on their team's profiles.`
      );
    }
    if (before.visibleToEmployee !== after.visibleToEmployee) {
      sentences.push(
        after.visibleToEmployee
          ? `Employees see their ${field.noun} on My Profile.`
          : `Employees stop seeing their ${field.noun} on My Profile.`
      );
    }
    if (before.required !== after.required) {
      sentences.push(after.required ? `${field.label} becomes required on new and edited records.` : `${field.label} becomes optional.`);
    }
  }
  for (const option of SELF_SERVICE) {
    if (saved.selfService[option.key] !== draft.selfService[option.key]) {
      sentences.push(
        draft.selfService[option.key]
          ? `Employees can change their ${option.noun} on My Profile.`
          : `Employees can no longer change their ${option.noun}.`
      );
    }
  }
  if (sentences.length <= 2) return sentences.join(" ");
  const more = sentences.length - 2;
  return `${sentences.slice(0, 2).join(" ")} And ${more === 1 ? "1 more change" : `${more} more changes`}.`;
}

function failure(error: unknown): string | null {
  if (!error) return null;
  return error instanceof ApiError && error.errors[0] ? error.errors[0] : "Employee fields didn't save. Try again.";
}

/** Settings › Employee fields: who sees each profile field, and what employees change themselves. */
export function EmployeeFieldsSettings({ section }: { section: FusionSettingsSection }) {
  const editable = section.access === "manage";
  const query = usePeopleDataSettings();
  const update = useUpdatePeopleDataSettings();
  const saved = useMemo(() => (query.data ? toDraft(query.data) : undefined), [query.data]);
  const { mutateAsync } = update;
  const version = query.data?.version ?? null;
  const save = useCallback(
    (draft: EmployeeFieldsDraft) =>
      mutateAsync({
        expectedVersion: version,
        input: {
          employeeFieldConfig: Object.fromEntries(
            FIELDS.map((field) => [field.key, { visible: true, ...draft.fields[field.key] }])
          ),
          selfService: draft.selfService,
        },
      }),
    [mutateAsync, version]
  );
  const staged = useStagedSettings(saved, save, {
    onReload: () => void query.refetch(),
    leaveMessage: "Leave without saving? Your changes to Employee fields are discarded.",
  });
  const saver = useSettingsConflictSaver("core", [section.id], staged.conflict);
  const draft = staged.draft;

  if (query.error && !query.data) {
    return (
      <SettingsPage title={section.label}>
        <PageError title="Employee fields didn't load" onRetry={() => void query.refetch()} />
      </SettingsPage>
    );
  }

  const setRule = (key: FieldKey, audience: Audience, value: boolean) =>
    staged.update((current) => ({
      ...current,
      fields: { ...current.fields, [key]: { ...current.fields[key], [audience]: value } },
    }));

  return (
    <SettingsPage
      title={section.label}
      lastChange={section.lastChange}
      setUpAt={section.setUpAt}
      viewOnly={!editable}
      loading={!draft}
    >
      {draft ? (
        <>
          <SettingsBlock title="On a profile">
            <div className="overflow-hidden rounded-surface border border-border bg-card">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-inlay">
                  <tr className="type-meta text-muted-foreground">
                    <th scope="col" className="px-5 py-2.5 text-left font-semibold">Field</th>
                    {COLUMNS.map((column) => (
                      <th key={column.key} scope="col" className="w-[128px] px-2 py-2.5 text-center font-semibold">
                        {column.label}
                      </th>
                    ))}
                    <th scope="col" className="w-[96px] px-2 py-2.5 text-center font-semibold">HR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {FIELDS.map((field) => {
                    const rule = draft.fields[field.key];
                    const changed = saved ? JSON.stringify(saved.fields[field.key]) !== JSON.stringify(rule) : false;
                    return (
                      <tr key={field.key} className={cn("h-12", changed && "bg-primary-tint")}>
                        <th scope="row" className="px-5 text-left type-label font-semibold text-foreground">
                          {field.label}
                        </th>
                        {COLUMNS.map((column) => {
                          const value = rule[column.key];
                          return (
                            <td key={column.key} className="px-2 text-center">
                              {editable ? (
                                <Checkbox
                                  aria-label={`${field.label}: ${column.label}`}
                                  checked={value}
                                  disabled={field.locked.includes(column.key)}
                                  onCheckedChange={(next) => setRule(field.key, column.key, next === true)}
                                />
                              ) : (
                                <span className="text-foreground">
                                  {column.key === "required" ? (value ? "Yes" : "No") : value ? "Sees it" : "Hidden"}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-2 text-center">
                          {editable ? (
                            <Checkbox aria-label={`${field.label}: HR always sees it`} checked disabled />
                          ) : (
                            <span className="text-foreground">Sees it</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SettingsBlock>

          <SettingsBlock title="Employees can change">
            <SettingsRows>
              {SELF_SERVICE.map((option) => (
                <SettingsRow key={option.key} label={option.label} htmlFor={editable ? `self-service-${option.key}` : undefined}>
                  {editable ? (
                    <Switch
                      id={`self-service-${option.key}`}
                      checked={draft.selfService[option.key]}
                      onCheckedChange={(next) =>
                        staged.update((current) => ({
                          ...current,
                          selfService: { ...current.selfService, [option.key]: next },
                        }))
                      }
                    />
                  ) : (
                    <SettingsValue>{draft.selfService[option.key] ? "Yes" : "No"}</SettingsValue>
                  )}
                </SettingsRow>
              ))}
            </SettingsRows>
          </SettingsBlock>

          {editable && saved ? (
            <SettingsSaveBar
              changes={staged.changes}
              consequence={employeeFieldsConsequence(saved, draft)}
              saving={staged.saving}
              error={failure(staged.error)}
              conflict={saver}
              conflictPending={staged.conflict && !saver}
              onDiscard={staged.discard}
              onSave={() => void staged.submit()}
              onReload={staged.reload}
            />
          ) : null}
        </>
      ) : null}
    </SettingsPage>
  );
}
