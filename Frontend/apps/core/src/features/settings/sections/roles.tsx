"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import {
  ApiError,
  type AccessProfileSummaryDto,
  type CorePermissionCatalogItemDto,
  type FusionSettingsSection,
  type PermissionScope,
} from "@repo/api";
import { useSettingsConflictSaver } from "@repo/api/query";
import { useStagedSettings } from "@repo/api/react";
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  Textarea,
} from "@repo/ds";
import { FUSION_MODULE_ICONS, PageError, SettingsPage, SettingsSaveBar } from "@repo/ds/shell";
import {
  useAccessProfiles,
  useCorePermissionCatalog,
  useCreateAccessProfile,
  useDeleteAccessProfile,
  useUpdateAccessProfile,
  useUserAccessAssignments,
} from "@/features/access/api/use-core-access";

export type Level = "None" | "View" | "Manage";

/** One thing a role can see or change, as people name it, and the permissions behind it. */
interface Area {
  id: string;
  label: string;
  view?: string;
  manage?: string;
}

/** What a role grants, per module. Permissions outside these areas are kept as they are when a role is saved. */
export const ROLE_AREAS: { module: "performance" | "core"; label: string; areas: Area[] }[] = [
  {
    module: "performance",
    label: "Performance",
    areas: [
      { id: "cycles", label: "Cycles", view: "performance.cycle.view", manage: "performance.cycle.manage" },
      { id: "performance-settings", label: "Performance settings", view: "performance.settings.view", manage: "performance.settings.manage" },
      { id: "company-objectives", label: "Company objectives", manage: "performance.objective.org.manage" },
      { id: "company-direction", label: "Company direction", manage: "performance.strategy.publish" },
      { id: "calibration", label: "Calibration", manage: "performance.review.calibrate" },
    ],
  },
  {
    module: "core",
    label: "Core HR",
    areas: [
      { id: "people", label: "People", view: "core.employee.view", manage: "core.employee.manage" },
      { id: "organization", label: "Organization", view: "core.organization.view", manage: "core.organization.manage" },
      { id: "employee-fields", label: "Employee fields", view: "settings.peopleData.view", manage: "settings.peopleData.manage" },
      { id: "roles", label: "Roles and access", view: "access.profiles.view", manage: "access.profiles.manage" },
      { id: "invitations", label: "Invitations", view: "settings.provisioning.view", manage: "settings.provisioning.manage" },
      { id: "change-history", label: "Change history", view: "settings.governance.view" },
    ],
  },
];

const ALL_AREAS = ROLE_AREAS.flatMap((group) => group.areas);
const AREA_KEYS = new Set(ALL_AREAS.flatMap((area) => [area.view, area.manage].filter((key): key is string => Boolean(key))));

export function levelsOf(profile: Pick<AccessProfileSummaryDto, "grants">): Record<string, Level> {
  const held = new Set(profile.grants.map((grant) => grant.permissionKey));
  return Object.fromEntries(
    ALL_AREAS.map((area) => [
      area.id,
      area.manage && held.has(area.manage) ? "Manage" : area.view && held.has(area.view) ? "View" : "None",
    ])
  );
}

function widest(scopes: readonly PermissionScope[] | undefined): PermissionScope {
  if (!scopes?.length) return "Tenant";
  return scopes.includes("Tenant") ? "Tenant" : scopes[scopes.length - 1]!;
}

/** The grants a role holds after its areas are set: everything outside the areas stays as it was. */
export function grantsFor(
  profile: Pick<AccessProfileSummaryDto, "grants">,
  levels: Record<string, Level>,
  catalog: readonly CorePermissionCatalogItemDto[]
): { permissionKey: string; scope: PermissionScope }[] {
  const kept = profile.grants
    .filter((grant) => !AREA_KEYS.has(grant.permissionKey))
    .map((grant) => ({ permissionKey: grant.permissionKey, scope: grant.scope }));
  const scopeOf = (key: string) =>
    profile.grants.find((grant) => grant.permissionKey === key)?.scope ??
    widest(catalog.find((item) => item.permissionKey === key)?.allowedScopes);
  const added = ALL_AREAS.flatMap((area) => {
    const level = levels[area.id] ?? "None";
    const keys =
      level === "Manage" ? [area.manage ?? area.view, area.view] : level === "View" ? [area.view ?? area.manage] : [];
    return [...new Set(keys.filter((key): key is string => Boolean(key)))].map((key) => ({ permissionKey: key, scope: scopeOf(key) }));
  });
  return [...kept, ...added];
}

/** What saving a role does, in one sentence. */
export function roleConsequence(name: string, saved: Record<string, Level>, draft: Record<string, Level>): string {
  const changed = ALL_AREAS.filter((area) => saved[area.id] !== draft[area.id]);
  if (changed.length === 0) return "";
  const first = changed[0]!;
  const level = draft[first.id];
  const what = first.label.charAt(0).toLowerCase() + first.label.slice(1);
  const sentence =
    level === "None"
      ? `People holding ${name} lose ${what}.`
      : `People holding ${name} can ${level === "Manage" ? "manage" : "see"} ${what}.`;
  return changed.length > 1 ? `${sentence} And ${changed.length - 1} more.` : sentence;
}

function isBuiltIn(profile: AccessProfileSummaryDto) {
  return profile.type === "SystemSeeded" || profile.isSystemProtected;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts.length > 1 ? `${parts[0]![0]}${parts[parts.length - 1]![0]}` : (parts[0] ?? "").slice(0, 2)) || "?").toUpperCase();
}

function RoleList({
  title,
  roles,
  selected,
  onSelect,
}: {
  title: string;
  roles: AccessProfileSummaryDto[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  if (roles.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <p className="px-3 pt-2 pb-1 type-meta text-muted-foreground">{title}</p>
      {roles.map((role) => (
        <button
          key={role.id}
          type="button"
          aria-current={role.id === selected ? "true" : undefined}
          onClick={() => onSelect(role.id)}
          className={cn(
            "flex items-center gap-3 rounded-control px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            role.id === selected ? "bg-inlay" : "hover:bg-inlay/60"
          )}
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate type-label font-semibold text-foreground">{role.name}</span>
            {role.description ? <span className="truncate type-meta text-muted-foreground">{role.description}</span> : null}
          </span>
          <span className="shrink-0 type-meta tabular-nums text-muted-foreground" aria-label={`${role.assignedUserCount} people`}>
            {role.assignedUserCount}
          </span>
        </button>
      ))}
    </div>
  );
}

function NewRoleDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const create = useCreateAccessProfile({ onSuccess: (role) => onCreated(role.id) });
  const error = create.error instanceof ApiError ? create.error.errors[0] : create.error ? "The role wasn't created." : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New role</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void create.mutateAsync({ name: name.trim(), description: description.trim() || null, grants: [] }).catch(() => undefined);
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-name">Name</Label>
            <Input id="role-name" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-description">What it is for</Label>
            <Textarea id="role-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
          </div>
          {error ? <p role="alert" className="type-meta text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || create.isLoading}>
              Create role
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** One role: who holds it, and what it grants per module. A tenant role can be edited by a manager. */
function RoleDetail({
  role,
  editable,
  holders,
  catalog,
  onDeleted,
}: {
  role: AccessProfileSummaryDto;
  editable: boolean;
  holders: string[] | null;
  catalog: readonly CorePermissionCatalogItemDto[];
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const saved = useMemo(() => levelsOf(role), [role]);
  const update = useUpdateAccessProfile();
  const remove = useDeleteAccessProfile({ onSuccess: onDeleted });
  const { mutateAsync } = update;
  const save = useCallback(
    (levels: Record<string, Level>) =>
      mutateAsync({
        profileId: role.id,
        expectedVersion: role.version,
        input: { name: role.name, description: role.description, grants: grantsFor(role, levels, catalog) },
      }).then(() => setEditing(false)),
    [mutateAsync, role, catalog]
  );
  const staged = useStagedSettings(saved, save, {
    leaveMessage: `Leave without saving? Your changes to ${role.name} are discarded.`,
  });
  const saver = useSettingsConflictSaver("core", ["roles"], staged.conflict);
  const levels = staged.draft ?? saved;
  const builtIn = isBuiltIn(role);
  const canEdit = editable && !builtIn;

  useEffect(() => setEditing(false), [role.id]);

  return (
    <div className="flex flex-col gap-6 rounded-surface border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="type-section-title text-foreground">{role.name}</h2>
          {role.description ? <p className="type-body-secondary text-muted-foreground">{role.description}</p> : null}
        </div>
        {canEdit && !editing ? (
          <div className="flex shrink-0 gap-2">
            {role.assignedUserCount === 0 ? (
              <Button variant="ghost" size="sm" disabled={remove.isLoading} onClick={() => void remove.mutateAsync({ profileId: role.id })}>
                Delete
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3 rounded-control bg-inlay px-4 py-3">
        {holders && holders.length > 0 ? (
          <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-card text-[10px] font-semibold ring-1 ring-border">
            {initials(holders[0]!)}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 text-sm text-foreground">
          {holders && holders.length > 0
            ? holders.length === 1
              ? `${holders[0]} holds it`
              : `${holders[0]} and ${holders.length - 1} more hold it`
            : role.assignedUserCount === 0
              ? "Nobody holds it"
              : role.assignedUserCount === 1
                ? "1 person holds it"
                : `${role.assignedUserCount} people hold it`}
        </span>
        <a href="/core/workforce-access" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-foreground hover:underline">
          Manage in Access
          <ArrowRight aria-hidden className="size-4" />
        </a>
      </div>

      {ROLE_AREAS.map((group) => {
        const Icon = FUSION_MODULE_ICONS[group.module];
        return (
          <section key={group.module} className="flex flex-col">
            <h3 className="mb-1 flex items-center gap-2 type-label font-semibold text-foreground">
              <span className="grid size-6 place-items-center rounded-detail bg-primary-tint text-primary-ink">
                {Icon ? <Icon aria-hidden className="size-3.5" /> : null}
              </span>
              {group.label}
            </h3>
            <ul className="divide-y divide-border">
              {group.areas.map((area) => {
                const level = levels[area.id] ?? "None";
                const options: Level[] = ["None", ...(area.view ? (["View"] as Level[]) : []), ...(area.manage ? (["Manage"] as Level[]) : [])];
                return (
                  <li key={area.id} className="flex min-h-11 items-center justify-between gap-4 py-2">
                    <span className="type-label font-semibold text-foreground">{area.label}</span>
                    {editing ? (
                      <NativeSelect
                        aria-label={area.label}
                        size="sm"
                        value={level}
                        onChange={(event) =>
                          staged.update((current) => ({ ...current, [area.id]: event.target.value as Level }))
                        }
                        className="w-32"
                      >
                        {options.map((option) => (
                          <NativeSelectOption key={option} value={option}>
                            {option}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    ) : (
                      <span className={cn("text-sm", level === "None" ? "text-muted-foreground" : "font-semibold text-foreground")}>
                        {level}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {editing ? (
        staged.dirty || staged.conflict ? (
          <SettingsSaveBar
            changes={staged.changes}
            consequence={roleConsequence(role.name, saved, levels)}
            saving={staged.saving}
            error={staged.error instanceof ApiError ? staged.error.errors[0] ?? "The role didn't save." : staged.error ? "The role didn't save." : null}
            conflict={saver}
            conflictPending={staged.conflict && !saver}
            onDiscard={() => {
              staged.discard();
              setEditing(false);
            }}
            onSave={() => void staged.submit()}
            onReload={() => {
              staged.reload();
              setEditing(false);
            }}
          />
        ) : (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Done
            </Button>
          </div>
        )
      ) : null}
    </div>
  );
}

/** Settings › Roles: built-in and tenant roles, what each grants per module; who holds them is managed in Access. */
export function RolesSettings({ section }: { section: FusionSettingsSection }) {
  const editable = section.access === "manage";
  const profiles = useAccessProfiles();
  const catalog = useCorePermissionCatalog();
  const assignments = useUserAccessAssignments();
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const roles = useMemo(() => profiles.data ?? [], [profiles.data]);
  const builtIn = roles.filter(isBuiltIn);
  const yours = roles.filter((role) => !isBuiltIn(role));
  const current = roles.find((role) => role.id === selected) ?? yours[0] ?? builtIn[0] ?? null;
  const holders = useMemo(() => {
    if (!current || !assignments.data) return null;
    return assignments.data
      .filter((person) => person.accessProfiles.some((profile) => profile.id === current.id))
      .map((person) => person.fullName);
  }, [assignments.data, current]);

  if (profiles.error && !profiles.data) {
    return (
      <SettingsPage title={section.label} wide>
        <PageError title="Roles didn't load" onRetry={() => void profiles.refetch()} />
      </SettingsPage>
    );
  }

  return (
    <SettingsPage
      title={section.label}
      lastChange={section.lastChange}
      setUpAt={section.setUpAt}
      viewOnly={!editable}
      wide
      loading={profiles.isLoading}
      aside={
        editable ? (
          <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden className="size-4" />
            New role
          </Button>
        ) : null
      }
    >
      <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <nav aria-label="Roles" className="flex flex-col gap-2 rounded-surface border border-border bg-card p-2">
          <RoleList title="Built in" roles={builtIn} selected={current?.id ?? null} onSelect={setSelected} />
          <RoleList title="Yours" roles={yours} selected={current?.id ?? null} onSelect={setSelected} />
        </nav>
        {current ? (
          <RoleDetail
            key={current.id}
            role={current}
            editable={editable}
            holders={holders}
            catalog={catalog.data ?? []}
            onDeleted={() => setSelected(null)}
          />
        ) : null}
      </div>
      <NewRoleDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(id) => {
          setCreating(false);
          setSelected(id);
        }}
      />
    </SettingsPage>
  );
}
