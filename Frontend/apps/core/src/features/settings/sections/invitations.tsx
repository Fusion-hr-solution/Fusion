"use client";

import { useCallback, useMemo } from "react";
import { ApiError, type FusionSettingsSection, type ProvisioningSettingsDto } from "@repo/api";
import { useSettingsConflictSaver } from "@repo/api/query";
import { useStagedSettings } from "@repo/api/react";
import { cn, Input, NativeSelect, NativeSelectOption, RadioGroup, RadioGroupItem } from "@repo/ds";
import {
  PageError,
  SettingsBlock,
  SettingsPage,
  SettingsRow,
  SettingsRows,
  SettingsSaveBar,
  SettingsValue,
} from "@repo/ds/shell";
import { useAccessProfiles } from "@/features/access/api/use-core-access";
import {
  useProvisioningSettings,
  useUpdateProvisioningSettings,
} from "@/features/settings/api/use-tenant-settings";

const REINVITE = [
  { value: "RefreshExisting", label: "Send a fresh one", detail: "The earlier link stops working" },
  { value: "KeepExisting", label: "Keep the first one", detail: "Nothing is sent again" },
] as const;

const DEFAULT_ROLE = "Employee";

/** What saving does, from what changed. */
export function invitationsConsequence(saved: ProvisioningSettingsDto, draft: ProvisioningSettingsDto, roleName: string): string {
  const sentences: string[] = [];
  if (saved.inviteExpiryDays !== draft.inviteExpiryDays)
    sentences.push(`Invitations sent from now on expire after ${draft.inviteExpiryDays} ${draft.inviteExpiryDays === 1 ? "day" : "days"}.`);
  if (saved.resendCooldownHours !== draft.resendCooldownHours)
    sentences.push(`People wait ${draft.resendCooldownHours} ${draft.resendCooldownHours === 1 ? "hour" : "hours"} before asking for a new link.`);
  if (saved.defaultAccessProfileId !== draft.defaultAccessProfileId)
    sentences.push(`New accounts get the ${roleName} role.`);
  if (saved.pendingInviteBehavior !== draft.pendingInviteBehavior)
    sentences.push(
      draft.pendingInviteBehavior === "KeepExisting"
        ? "Inviting someone again keeps their first link."
        : "Inviting someone again sends a fresh link and stops the earlier one."
    );
  return sentences.join(" ");
}

function NumberField({
  id,
  label,
  value,
  unit,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <>
      <Input
        id={id}
        aria-label={label}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        className="h-9 w-16 text-center font-semibold tabular-nums"
      />
      <span className="w-10 type-meta text-muted-foreground">{unit}</span>
    </>
  );
}

function failure(error: unknown): string | null {
  if (!error) return null;
  return error instanceof ApiError && error.errors[0] ? error.errors[0] : "Invitations didn't save. Try again.";
}

/** Settings › Invitations: how Fusion invites new people. */
export function InvitationsSettings({ section }: { section: FusionSettingsSection }) {
  const editable = section.access === "manage";
  const query = useProvisioningSettings();
  const profiles = useAccessProfiles();
  const update = useUpdateProvisioningSettings();
  const saved = query.data?.provisioning;
  const version = query.data?.version ?? null;
  const { mutateAsync } = update;
  const save = useCallback(
    (draft: ProvisioningSettingsDto) => mutateAsync({ expectedVersion: version, input: { provisioning: draft } }),
    [mutateAsync, version]
  );
  const staged = useStagedSettings(saved, save, {
    onReload: () => void query.refetch(),
    leaveMessage: "Leave without saving? Your changes to Invitations are discarded.",
  });
  const saver = useSettingsConflictSaver("core", [section.id], staged.conflict);
  const draft = staged.draft;

  const roleName = useCallback(
    (id: string | null) => (id ? profiles.data?.find((profile) => profile.id === id)?.name ?? "chosen" : DEFAULT_ROLE),
    [profiles.data]
  );
  const roles = useMemo(() => profiles.data ?? [], [profiles.data]);

  if (query.error && !query.data) {
    return (
      <SettingsPage title={section.label}>
        <PageError title="Invitations didn't load" onRetry={() => void query.refetch()} />
      </SettingsPage>
    );
  }

  const set = (change: Partial<ProvisioningSettingsDto>) => staged.update((current) => ({ ...current, ...change }));

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
          <SettingsRows>
            <SettingsRow label="Invitation expires after" htmlFor={editable ? "invite-expiry" : undefined}>
              {editable ? (
                <NumberField
                  id="invite-expiry"
                  label="Invitation expires after, in days"
                  value={draft.inviteExpiryDays}
                  unit="days"
                  min={1}
                  max={90}
                  onChange={(value) => set({ inviteExpiryDays: value })}
                />
              ) : (
                <SettingsValue>{draft.inviteExpiryDays} days</SettingsValue>
              )}
            </SettingsRow>
            <SettingsRow label="People can ask for a new one after" htmlFor={editable ? "invite-cooldown" : undefined}>
              {editable ? (
                <NumberField
                  id="invite-cooldown"
                  label="People can ask for a new one after, in hours"
                  value={draft.resendCooldownHours}
                  unit="hours"
                  min={0}
                  max={720}
                  onChange={(value) => set({ resendCooldownHours: value })}
                />
              ) : (
                <SettingsValue>{draft.resendCooldownHours} hours</SettingsValue>
              )}
            </SettingsRow>
            <SettingsRow label="Role for new accounts" htmlFor={editable ? "invite-role" : undefined}>
              {editable ? (
                <NativeSelect
                  id="invite-role"
                  value={draft.defaultAccessProfileId ?? ""}
                  onChange={(event) => set({ defaultAccessProfileId: event.target.value || null })}
                  className="w-48"
                >
                  <NativeSelectOption value="">{DEFAULT_ROLE}</NativeSelectOption>
                  {roles
                    .filter((role) => role.name !== DEFAULT_ROLE)
                    .map((role) => (
                      <NativeSelectOption key={role.id} value={role.id}>
                        {role.name}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
              ) : (
                <SettingsValue>{roleName(draft.defaultAccessProfileId)}</SettingsValue>
              )}
            </SettingsRow>
          </SettingsRows>

          <SettingsBlock title="Inviting someone who already has an invitation">
            {editable ? (
              <RadioGroup
                aria-label="Inviting someone who already has an invitation"
                value={draft.pendingInviteBehavior}
                onValueChange={(value) => set({ pendingInviteBehavior: value })}
                className="gap-3"
              >
                {REINVITE.map((option) => {
                  const selected = draft.pendingInviteBehavior === option.value;
                  return (
                    <label
                      key={option.value}
                      htmlFor={`reinvite-${option.value}`}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-surface border px-5 py-4 transition-colors",
                        selected ? "border-primary bg-primary-tint" : "border-border bg-card hover:border-foreground/30"
                      )}
                    >
                      <RadioGroupItem id={`reinvite-${option.value}`} value={option.value} className="mt-0.5" />
                      <span className="flex flex-col gap-0.5">
                        <span className="type-label font-semibold text-foreground">{option.label}</span>
                        <span className="type-meta text-muted-foreground">{option.detail}</span>
                      </span>
                    </label>
                  );
                })}
              </RadioGroup>
            ) : (
              <SettingsRows>
                <SettingsRow
                  label={REINVITE.find((option) => option.value === draft.pendingInviteBehavior)?.label ?? draft.pendingInviteBehavior}
                  description={REINVITE.find((option) => option.value === draft.pendingInviteBehavior)?.detail}
                />
              </SettingsRows>
            )}
          </SettingsBlock>

          {editable && saved ? (
            <SettingsSaveBar
              changes={staged.changes}
              consequence={invitationsConsequence(saved, draft, roleName(draft.defaultAccessProfileId))}
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
